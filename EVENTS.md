# Event Definitions

This document outlines the different event types used in the system, their data payloads, and the actions workers should take when processing them.

---

## 1. Granular File Events

These events represent discrete changes to a single file. They are designed to be processed by a single queue that uses groups to ensure that all operations for a specific file (`ino`) are processed sequentially.

### A Note on Event Interpretation

It is critical to understand that the events below are not a direct 1:1 mapping of raw filesystem events. A file watcher service is responsible for interpreting raw events (e.g., `add`, `unlink`, `rename`) and creating the appropriate job based on the context of monitored shares. This "boundary-aware" logic is crucial for correctness.

*   A file moved from a monitored share to an **unmonitored** location is interpreted as a `file.removed` event.
*   A file moved from an unmonitored location to a **monitored** share is interpreted as a `file.upsert` event.
*   A file moved between two **monitored** locations is a true `file.moved` event.

### 1.1 `file.upsert`

This event is triggered when a new file is created, an existing file's contents have changed, or a file is moved into a monitored share from an unmonitored location.

*   **Event Name**: `file.upsert`
*   **Data Payload**: `{ "path": "/mnt/user/share/file.txt" }`
*   **Required Action**:
    1.  Get file stats for the given `path` to retrieve its `ino` and `size`.
    2.  Query Redis for all known files with the **exact same size**.
    3.  **If no files of the same size exist:**
        *   The file is unique by size. Hash the file's contents.
        *   Save the new metadata (including the hash) to Redis, using the `ino` as the primary key.
    4.  **If files of the same size exist:**
        *   This indicates potential duplicates. Add a new job to the queue for a targeted hashing process.
        *   This new job will contain the `path` of the triggering file and the list of paths of the potential duplicates. The hashing worker will then efficiently compare the new file against the existing ones.

### 1.2 `file.removed`

This event is triggered when a file path is deleted or a file is moved from a monitored share to an unmonitored location. It correctly handles hard links.

*   **Event Name**: `file.removed`
*   **Data Payload**: `{ "path": "/mnt/user/share/removed.txt", "ino": "12345" }`
    *   **Note**: The `ino` must be captured by the file watcher *before* the file is deleted/moved.
*   **Required Action**:
    1.  Fetch the file's record from Redis using the `ino` from the payload.
    2.  If the record exists, remove the `path` from the `paths` array.
    3.  Check the `paths` array:
        *   If the array is now **empty**, it was the last hard link. Delete the entire record from Redis.
        *   If the array is **not empty**, other hard links still exist. Save the updated record.

### 1.3 `file.moved`

This event is triggered when a file is renamed or moved, and both the source and destination paths are within monitored shares.

*   **Event Name**: `file.moved`
*   **Data Payload**: `{ "oldPath": "/mnt/user/share/old.txt", "newPath": "/mnt/user/share/new.txt" }`
*   **Required Action**:
    1.  Get the `ino` of the file at `newPath`.
    2.  Find the corresponding record in Redis using the `ino`.
    3.  Update the record by removing `oldPath` from its list of paths and adding `newPath`.
    4.  *(No re-hashing is needed, as the content has not changed).*

---

## 2. Bulk Operations

These events represent large-scale, long-running tasks that operate on entire shares or the whole dataset. They are treated as orchestrators that may generate many smaller, granular jobs.

### 2.1 `scan`

This event triggers a full scan of one or more shares to find duplicate files.

*   **Event Name**: `scan`
*   **Data Payload**: `{ "shares": ["/mnt/user/share1", "/mnt/user/share2"] }`
*   **Required Action**:
    1.  The `scan` process iterates through all files in the specified shares.
    2.  It groups files by size, identifying potential duplicate groups.
    3.  For each group of potential duplicates, it adds a job to the queue for processing by the hashing workers.
    4.  Unique files (by size) are updated in Redis directly without a hashing job.

### 2.2 `share.add`

This event is triggered when a new share is added to the list of monitored locations.

*   **Event Name**: `share.add`
*   **Data Payload**: `{ "share": "/mnt/user/new_share" }`
*   **Required Action**: TBD. This will likely trigger an initial scan of the new share.

### 2.3 `share.remove`

This event is triggered when a share is removed from the list of monitored locations.

*   **Event Name**: `share.remove`
*   **Data Payload**: `{ "share": "/mnt/user/removed_share" }`
*   **Required Action**: TBD. This will involve removing all records associated with the removed share from Redis.
