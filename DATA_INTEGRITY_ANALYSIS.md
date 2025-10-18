# Data Integrity Analysis Report

## 1. Summary

This report details critical data integrity vulnerabilities discovered in the DIRT file repository system. The analysis focused on the real-time event processing pipeline and its interaction with the bulk scanning mechanism.

Two primary categories of issues were identified:
1.  **Race Conditions in Real-Time Event Handling:** The concurrency model, while designed to be efficient, allows for specific sequences of events (`rename` and `upsert`) to execute in parallel, leading to data corruption.
2.  **Lack of Synchronization Between Bulk Scan and Real-Time Events:** The initial file scanning process can run concurrently with the real-time event listener, leading to a race condition where the final database state does not accurately reflect the filesystem.

These vulnerabilities can lead to an inconsistent and unreliable file index, defeating the core purpose of the system.

---

## 2. Vulnerability Details

### 2.1. Critical Race Condition: `rename` vs. `upsert` (Resolved)

**- Description:**
A race condition previously existed when a `rename` operation on a file occurred concurrently with an `upsert` operation on the destination path. The system's job queueing logic did not serialize these conflicting operations, allowing them to run in parallel and corrupt the file's metadata record.

**- Scenario:**
1.  A file is moved: `mv /path/A /path/B`. A `rename` job is queued.
2.  Simultaneously, the file is modified at `/path/B`. An `upsert` job is queued.
3.  Because the jobs had different `groupId`s, they could be processed concurrently.
4.  If the `upsert` job ran first, it correctly updated the file's record to show its new path (`B`).
5.  When the `rename` job subsequently ran, its flawed logic would fetch the record by the inode of path `B`, fail to find the expected `oldPath` (`A`), and incorrectly add `B` again.
6.  **Original Result:** The file record was corrupted with a duplicate entry, e.g., `path: ['/path/B', '/path/B']`.

**- Root Cause (Original):**
-   **Insufficient `groupId` Logic:** The `groupId` for a `rename` event was based only on the source path, which was insufficient to prevent conflicts with events related to the destination path.
-   **Flawed Handler Logic:** The `handleRename` function in `nodejs/handlers.js` was not robust. Its fallback behavior when `oldPath` was not found created corrupt data.

**- Resolution (Implemented):**
The `handleRename` function in `nodejs/handlers.js` was refactored to be deterministic and safe. The new logic first searches for the file record by its `oldPath`.
- If no record is found, it correctly determines that the database state has already been updated by another job (like the `upsert`) and exits gracefully.
- This change resolves the race condition and prevents data corruption. This issue is now marked as **Resolved**.

### 2.2. Logical Flaw: `handleRename` Inode-Based Logic (Resolved)

**- Description (Original Flaw):**
The `handleRename` function was fundamentally flawed because it initiated its logic based on the state of the *destination path* (`newPath`), not the source. It previously fetched the file's inode from the filesystem at `newPath` and used that as the primary key for the Redis lookup. This approach was unreliable, especially in cases of cross-filesystem moves (where the inode changes) or if another file existed at the destination path.

**- Resolution (Implemented):**
This logical flaw has been **Resolved**. The `handleRename` function no longer relies on `fs.stat` or the state of the `newPath`. It now correctly uses the `oldPath` to perform a search query in Redis, reliably finding the correct record that needs to be updated. This resolves the failure modes associated with the previous inode-based logic.

### 2.3. Major Race Condition: Bulk Scan vs. Real-Time Events (Resolved)

**- Description:**
A race condition previously existed between the initial bulk `scan` process and the real-time event listener. Because they could run concurrently, it was possible for the database to be updated with stale information from the scan *after* a more recent real-time event had already been processed, leading to a "ghost" record for a file that no longer existed.

**- Resolution (Implemented):**
This race condition has been **Resolved** by implementing a robust lifecycle management system for the initial scan. The system now correctly differentiates between the first-ever run and subsequent restarts.

-   **Conditional Startup:** On application start, the system checks for the existence of any file records in Redis (`ino:*`). If none are found, it waits for the user to trigger the first scan. If records exist, it starts the real-time event listener immediately, ensuring normal operation on restart.
-   **Scan Lifecycle:** When the initial scan is triggered, a precise sequence ensures data integrity:
    1.  The BullMQ job queue is **paused**.
    2.  The real-time listener and the scan process are started **concurrently**. The listener adds incoming real-time events to the paused queue.
    3.  The scan adds its own jobs for hashing to the **front** of the queue (LIFO).
    4.  The queue is **resumed**.

This ensures that the scan's jobs are always processed before any real-time events that occurred during the scan, establishing an authoritative baseline and preventing any data corruption.

---

## 3. Unresolved Vulnerabilities

### 3.1. Critical Race Condition: Concurrent Hashing Jobs (Unresolved)

**- Description:**
A critical race condition exists because the system processes hashing jobs for different files concurrently, even when those files belong to the same potential duplicate group (i.e., they have the same size). This lack of serialization affects both the initial bulk scan and real-time `upsert` events, leading to an inconsistent database state where not all identical files are correctly identified and linked.

**- Root Cause:**
-   **Insufficient `groupId` Logic:**
    -   For real-time `upsert` events, the `groupId` is the file's path. This allows two different files of the same size to be processed concurrently.
    -   For `file-group` jobs during the initial scan, **no `groupId` is used at all**. This allows all potential duplicate groups to be processed concurrently.
-   **Non-Atomic Updates:** The process of identifying and saving a set of duplicates is not atomic. Two concurrent jobs can read the same candidate file information from the database, perform their own independent hashing, and then race to write the results back. The "last write wins," causing other legitimate duplicates to be excluded from the final record.

**- Scenario 1: Real-Time `upsert` Event**
1.  Three files exist: `A`, `B`, and `C`. All are the same size. `B` and `C` are already in the database but have no hash.
2.  File `A` is modified to be identical to `B`. An `upsert` job (`Job A`) is queued.
3.  Simultaneously, file `C` is modified to be identical to `B`. An `upsert` job (`Job C`) is queued.
4.  `Job A` and `Job C` start concurrently.
5.  `Job A` queries for files of the same size and finds `B`. It begins a hashing comparison.
6.  `Job C` queries for files of the same size and also finds `B`. It begins its own hashing comparison.
7.  `Job A` confirms `A` and `B` are duplicates. It saves both records with a new shared hash `H1`.
8.  `Job C` confirms `C` and `B` are duplicates. It saves both records with the same shared hash `H1`.
9.  **Result:** The final database state correctly links `C` and `B`, but `A` is left as an independent record without a hash, even though it is identical to the other two. The duplicate group is incomplete.

**- Scenario 2: Initial Bulk Scan**
1.  Four files exist: `file1`, `file2`, `file3`, `file4`. All are identical.
2.  The `scan` process identifies two potential duplicate groups based on size: `Group A = [file1, file2]` and `Group B = [file3, file4]`.
3.  Two `file-group` jobs are queued without a `groupId`: `Job A` for `Group A` and `Job B` for `Group B`.
4.  The jobs run concurrently.
5.  `Job A` confirms `file1` and `file2` are duplicates and saves them with a shared hash `H1`.
6.  `Job B` confirms `file3` and `file4` are duplicates and saves them with a shared hash `H2` (which will be identical to `H1`, but the system doesn't know that).
7.  **Result:** The database incorrectly shows two separate duplicate pairs instead of one group of four.

**- Status:** This vulnerability is **Unresolved**.