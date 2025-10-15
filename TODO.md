# DiRT Project TODO List

This document tracks outstanding tasks, bugs, and potential improvements for the D.I.R.T. project, consolidated from multiple code evaluations.

---

## High Priority

### 1. Improve Job Failure Reporting in `process.js`
*   **Issue:** The main `try...catch` block in `processDuplicates` catches errors but does not propagate them. If a job fails due to an I/O error, the BullMQ worker will report it as 'completed' successfully, leading to silent failures where duplicate groups are not processed.
*   **Recommendation:** Modify the `catch` block to re-throw the error. This will cause the BullMQ job to be marked as 'failed', providing accurate feedback on the processing status and preventing data integrity issues.
*   **Source:** `process_js_evaluation.md`, `process_js_evaluation-claude.md`

### 2. Use File Path as Primary Key Instead of Inode
*   **Issue:** The application currently uses the file `ino` (inode number) as the primary key for maps and data structures. While generally unique on a single `ext4`/`xfs` filesystem, inode numbers can be reused or be non-unique across different filesystems, especially with network mounts (NFS/SMB) or complex setups like `overlayfs`. This could lead to incorrect file identification.
*   **Recommendation:** Refactor the code to use the full, absolute file path (`file.path[0]`) as the primary key for all maps (`fileInfoMap`, `fileHandles`) and for the Redis primary key. This guarantees uniqueness across all environments.
*   **Source:** `process_js_evaluation-chatgpt.md`

---

## Medium Priority

### 1. Use `Promise.allSettled` for Increased Resilience
*   **Issue:** In `process.js`, concurrent operations (like hashing chunks or closing file handles) use `Promise.all`. If a single promise in the batch rejects, the entire operation is aborted.
*   **Recommendation:** Replace `Promise.all` with `Promise.allSettled` in two key places:
    1.  When hashing chunks in `processChunk` to allow the batch to continue even if one file's hash fails.
    2.  When closing file handles in the `finally` block to ensure all handles are attempted to be closed, even if one fails.
*   **Source:** `jules_evaluation_report.md`, `process_js_evaluation-claude.md`

### 2. Handle Potential File Truncation Race Condition
*   **Issue:** The file size is checked at the beginning of the scan. If a file is truncated by an external process while it's being hashed, the logic will not detect this. It will generate a hash based on partial content, which could lead to incorrect matches or misses.
*   **Recommendation:** After the hashing loop in `processDuplicates`, verify that the total `bytesRead` matches the `size` recorded at the start. If they do not match, log a warning and exclude the file from being saved with a hash to maintain data integrity.
*   **Source:** `process_js_evaluation.md`

---

## Low Priority

### 1. Frontend JavaScript Modernization
*   **Issue:** The JavaScript in `dirtSettings.page` uses older conventions (`var`, global function scope).
*   **Recommendation:** Refactor the script to use modern `let`/`const` for better scoping. Wrap the code in an IIFE (Immediately Invoked Function Expression) or a simple object to avoid polluting the global namespace. This is a code hygiene improvement.
*   **Source:** `jules_evaluation_report.md`

### 2. Add Defensive Share Name Validation
*   **Issue:** While currently secure, the backend relies solely on prepending a static path (`/mnt/user/`) to prevent path traversal.
*   **Recommendation:** Add a second layer of defense-in-depth by validating the raw share names received in `dirt.js`. Ensure they do not contain path-related characters like `/` or `..` before using them.
*   **Source:** `jules_evaluation_report.md`

### 3. Validate Input Data Structures
*   **Issue:** Functions like `processDuplicates` assume the objects in the `initialGroup` array have a specific shape (e.g., `file.path`, `file.ino`) without any validation.
*   **Recommendation:** Add simple, non-intrusive checks at the beginning of critical functions to ensure that required properties exist on input objects. If not, throw a clear, informative error.
*   **Source:** `process_js_evaluation-claude.md`

### 4. Micro-optimization: Use Buffers for Hash Comparison
*   **Issue:** The code compares intermediate hashes as hex strings (`hasher.digest('hex')`).
*   **Recommendation:** For a minor performance gain, compare raw `Buffer` objects directly by using `hasher.digest()`. This avoids the overhead of hex string conversion and allocation.
*   **Source:** `process_js_evaluation-chatgpt.md`

### 5. Evaluate `isHardLinked` Tag Proposal
*   **Issue:** The current method for finding hard-linked files involves a full database scan. A proposal has been made to add a searchable `isHardLinked` tag to optimize this and the share deletion workflow.
*   **Recommendation:** Review the trade-offs outlined in `hard_link_tag_evaluation.md` and decide whether to implement the `isHardLinked` tag.
*   **Source:** `hard_link_tag_evaluation.md`

---
## Uncategorized
* Find out what happens to the inode in Unraid shfs if moved from one disk to another. We need to know if it invaliates the database record.
