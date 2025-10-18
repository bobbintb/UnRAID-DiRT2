# Data Integrity Analysis Report

## 1. Summary

This report details critical data integrity vulnerabilities discovered in the DIRT file repository system. The analysis focused on the real-time event processing pipeline and its interaction with the bulk scanning mechanism.

Two primary categories of issues were identified:
1.  **Race Conditions in Real-Time Event Handling:** The concurrency model, while designed to be efficient, allows for specific sequences of events (`rename` and `upsert`) to execute in parallel, leading to data corruption.
2.  **Lack of Synchronization Between Bulk Scan and Real-Time Events:** The initial file scanning process can run concurrently with the real-time event listener, leading to a race condition where the final database state does not accurately reflect the filesystem.

These vulnerabilities can lead to an inconsistent and unreliable file index, defeating the core purpose of the system.

---

## 2. Vulnerability Details

### 2.1. Critical Race Condition: `rename` vs. `upsert`

**- Description:**
A race condition exists when a `rename` operation on a file occurs concurrently with an `upsert` operation on the destination path. The system's job queueing logic fails to serialize these conflicting operations, allowing them to run in parallel and corrupt the file's metadata record.

**- Scenario:**
1.  A file is moved: `mv /path/A /path/B`. The listener queues a `rename` job with `jobPayload = { oldPath: A, newPath: B }` and `groupId = A`.
2.  Simultaneously, another process modifies the file at its new location, `/path/B`. The listener queues an `upsert` job with `jobPayload = { path: B }` and `groupId = B`.
3.  Because the `groupId`s are different, the BullMQ worker may process both jobs concurrently.
4.  If the `upsert` job runs first, it correctly updates the file's record.
5.  When the `rename` job runs, its logic is not prepared for this situation. It fetches the record by the inode of path `B`, fails to find the expected `oldPath` (`A`) in the record's path array, and incorrectly adds `B` as a new path.
6.  **Result:** The file record is corrupted with a duplicate entry, e.g., `path: ['/path/B', '/path/B']`.

**- Root Cause:**
-   **`nodejs/dirt.js`:** Assigns the `groupId` for a `rename` event based only on the *source path*. This is insufficient to prevent conflicts with events related to the *destination path*.
-   **`nodejs/handlers.js` (`handleRename`):** The handler's logic is not robust enough to handle this race condition. Its fallback behavior when `oldPath` is not found creates corrupt data.

**- Impact:** High. This directly corrupts the primary metadata of a file (its path), making the record inaccurate and potentially causing issues with any downstream logic that relies on a clean path array.

### 2.2. Logical Flaw: `handleRename` Inode-Based Logic

**- Description:**
The `handleRename` function is fundamentally flawed because it initiates its logic based on the state of the *destination path* (`newPath`), not the source. It fetches the file's inode from the filesystem at `newPath` and uses that to look up the record in Redis.

**- Root Cause:**
-   **`nodejs/handlers.js` (`handleRename`):** The function begins with `fs.promises.stat(newPath, { bigint: true })`. This makes several incorrect assumptions:
    1.  It assumes the `rename` operation does not change the file's inode (i.e., it was not moved across different physical disks/filesystems).
    2.  It assumes that no other file exists at `newPath` that could confuse the lookup.
    3.  It completely ignores the state of `oldPath`, which is the authoritative source for the record that needs to be updated.

**- Impact:** High. This flaw can lead to several failure modes:
-   **Incorrect Record Update:** If a different file already exists at `newPath`, the handler will fetch and modify the wrong record in Redis.
-   **Complete Failure:** If the rename was a cross-filesystem move (changing the inode), the lookup will fail to find the original record, and the update will not happen correctly.

### 2.3. Major Race Condition: Bulk Scan vs. Real-Time Events

**- Description:**
There is no synchronization mechanism between the initial bulk `scan` process and the real-time event listener. They can run concurrently, creating a race condition where the database can be updated with stale information from the scan *after* more recent real-time events have already been processed.

**- Scenario:**
1.  An administrator initiates a full `scan` on a large share.
2.  While the scan is in progress, traversing directories, a user deletes a file: `rm /path/to/somefile`.
3.  The real-time listener immediately picks up this event, and a `remove` job is processed, correctly deleting the file's record from Redis.
4.  A few moments later, the `scan` process, which had read the directory contents *before* the file was deleted, reaches the point in its execution where it saves data. It saves the record for `/path/to/somefile` back into the database.
5.  **Result:** The database now contains a "ghost" record for a file that no longer exists on the filesystem.

**- Root Cause:**
-   **`nodejs/scan.js` & `nodejs/dirt.js`:** These two modules operate independently. The `scan` function reads the filesystem over a period of time and is not aware of changes being processed in real-time by the `startInboxListener` function.

**- Impact:** High. This undermines the integrity of the entire repository, as it can re-introduce records for deleted files or overwrite newer data with stale data. The database cannot be trusted to be an accurate mirror of the filesystem.