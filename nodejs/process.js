const fs = require('fs');
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

const CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Initializes a Map with basic file information.
 * @param {object[]} initialGroup - The initial group of files.
 * @returns {Map<string, object>} A map from inode to file info.
 */
function initializeFileInfo(initialGroup) {
    const fileInfoMap = new Map();
    initialGroup.forEach(file => {
        // The hasher is no longer needed on the main thread; it lives in the worker.
        fileInfoMap.set(file.ino, { fileObject: file });
    });
    return fileInfoMap;
}

/**
 * Opens file handles for all files in the group concurrently.
 * @param {object[]} initialGroup - The group of files to open.
 * @returns {Promise<Map<string, fs.promises.FileHandle>>} A map from inode to file handle.
 */
async function openFileHandles(initialGroup) {
    const fileHandles = new Map();
    const openPromises = initialGroup.map(async (file) => {
        const handle = await fs.promises.open(file.path[0], 'r');
        return { ino: file.ino, handle };
    });

    const results = await Promise.all(openPromises);
    for (const result of results) {
        fileHandles.set(result.ino, result.handle);
    }
    return fileHandles;
}

/**
 * Processes one chunk of data for a set of file groups in parallel, refining the groups based on intermediate hashes.
 * @param {Array<Array<object>>} activeGroups - The current groups of potential duplicates.
 * @param {Map<string, fs.promises.FileHandle>} fileHandles - A map of file handles.
 * @param {Worker[]} workerPool - The pool of worker threads.
 * @param {number} currentChunkSize - The size of the chunk to read.
 * @param {number} bytesRead - The offset where to start reading.
 * @returns {Promise<Array<Array<object>>>} The refined groups for the next iteration.
 */
async function processChunk(activeGroups, fileHandles, workerPool, currentChunkSize, bytesRead) {
    const nextIterationGroups = [];
    let workerIndex = 0;

    for (const currentGroup of activeGroups) {
        if (currentGroup.length <= 1) {
            // If a group has only one member, it's not a duplicate, but we might need to
            // carry it over if it's the only group left. However, the main loop logic handles this.
            continue;
        }

        // 1. Concurrently read the next chunk for all files in the current group.
        const readPromises = currentGroup.map(async (fileInfo) => {
            const handle = fileHandles.get(fileInfo.fileObject.ino);
            // Allocate a unique buffer for each concurrent read operation to avoid race conditions.
            const buffer = Buffer.alloc(currentChunkSize);
            const { bytesRead: read } = await handle.read(buffer, 0, currentChunkSize, bytesRead);

            if (read === 0) return null;

            // Return the file's inode and the actual data read.
            return { ino: fileInfo.fileObject.ino, buffer: buffer.slice(0, read) };
        });

        const readResults = (await Promise.all(readPromises)).filter(r => r !== null);

        // 2. Distribute the hashing work to the worker pool.
        const hashPromises = readResults.map(({ ino, buffer }) => {
            return new Promise((resolve, reject) => {
                const worker = workerPool[workerIndex];
                workerIndex = (workerIndex + 1) % workerPool.length;

                const messageHandler = (response) => {
                    // Ensure we are handling the response for the correct file (ino).
                    if (response.ino === ino) {
                        worker.off('message', messageHandler); // Clean up listener.
                        if (response.type === 'result') {
                            resolve({ ino, hash: response.hash });
                        } else if (response.type === 'error') {
                            reject(new Error(`Worker error for ino ${ino}: ${response.error}`));
                        }
                    }
                };
                worker.on('message', messageHandler);

                // Transfer the buffer to the worker to avoid a copy, improving performance.
                const transferableBuffer = new Uint8Array(buffer);
                worker.postMessage({ type: 'process', ino, buffer: transferableBuffer }, [transferableBuffer.buffer]);
            });
        });

        const hashResults = await Promise.all(hashPromises);

        // 3. Group files by their returned intermediate hashes.
        const hashesThisRound = new Map();
        const inoToInfoMap = new Map(currentGroup.map(info => [info.fileObject.ino, info]));

        for (const { ino, hash } of hashResults) {
            if (!hashesThisRound.has(hash)) {
                hashesThisRound.set(hash, []);
            }
            const fileInfo = inoToInfoMap.get(ino);
            if (fileInfo) {
                hashesThisRound.get(hash).push(fileInfo);
            }
        }

        // 4. Collect the new subgroups that are still potential duplicates.
        for (const [hash, subGroup] of hashesThisRound.entries()) {
            if (subGroup.length > 1) {
                nextIterationGroups.push({ hash, group: subGroup });
            }
        }
    }
    return nextIterationGroups;
}

/**
 * Finalizes the process by assigning the definitive hash to all files in confirmed duplicate groups.
 * @param {Array<object>} finalGroupsWithHashes - The groups of confirmed duplicates, including their final hash.
 */
function finalizeHashes(finalGroupsWithHashes) {
    if (finalGroupsWithHashes.length > 0) {
        console.log('[DIRT] Incremental comparison complete. Finalizing hashes...');
        for (const { hash: finalHash, group: finalGroup } of finalGroupsWithHashes) {
            // The check for finalGroup.length > 1 is already handled by processChunk,
            // but we keep it as a safeguard.
            if (finalGroup.length > 1) {
                for (const fileInfo of finalGroup) {
                    fileInfo.fileObject.hash = finalHash;
                    console.log(`[DIRT] Assigned final hash ${finalHash} to file object for path(s): ${fileInfo.fileObject.path.join(', ')}`);
                }
            }
        }
    } else {
        console.log('[DIRT] No identical files confirmed in this group.');
    }
}

/**
 * Processes a group of files to find true duplicates by performing an efficient,
 * incremental comparison using intermediate hashes.
 *
 * @param {object[]} initialGroup An array of file objects that have the same size.
 * @param {number} size The size of the files in the group.
 */
async function processDuplicates(initialGroup, size, workerPool) {
    console.log(`[DIRT] Starting definitive incremental comparison for group of ${initialGroup.length} files with size ${size}.`);

    const fileInfoMap = initializeFileInfo(initialGroup);
    let activeGroups = [Array.from(fileInfoMap.values())];
    const fileHandles = await openFileHandles(initialGroup);

    let finalGroupsWithHashes = [];

    try {
        let bytesRead = 0;

        while (activeGroups.length > 0 && bytesRead < size) {
            const currentChunkSize = Math.min(CHUNK_SIZE, size - bytesRead);
            const resultsWithHashes = await processChunk(activeGroups, fileHandles, workerPool, currentChunkSize, bytesRead);
            bytesRead += currentChunkSize;

            if (resultsWithHashes.length === 0) {
                activeGroups = [];
                finalGroupsWithHashes = [];
                break;
            }

            activeGroups = resultsWithHashes.map(r => r.group);
            finalGroupsWithHashes = resultsWithHashes;

            if (activeGroups.length > 0) {
                const totalFiles = activeGroups.reduce((sum, group) => sum + group.length, 0);
                console.log(`[DIRT] Chunk comparison complete. ${totalFiles} potential duplicates remain in ${activeGroups.length} group(s).`);
            } else {
                break;
            }
        }

        finalizeHashes(finalGroupsWithHashes);

    } catch (error) {
        console.error(`[DIRT] Error during incremental comparison for size ${size}:`, error);
    } finally {
        for (const handle of fileHandles.values()) {
            await handle.close();
        }
        // Workers are not terminated here. Their lifecycle is managed by the calling process.
        // We do, however, need to reset their internal state for the next group.
        workerPool.forEach(worker => worker.postMessage({ type: 'reset' }));
        console.log(`[DIRT] Finished processing group for size ${size}.`);
    }
}

/**
 * Creates a pool of worker threads to handle CPU-intensive hashing tasks.
 * @returns {Worker[]} An array of worker instances.
 */
function createWorkerPool() {
    // Leave one core for the main thread and other system tasks.
    const numCores = os.cpus().length;
    const numWorkers = Math.max(1, numCores - 1);
    const workers = [];

    console.log(`[DIRT] Initializing a pool of ${numWorkers} worker thread(s) for hashing.`);

    for (let i = 0; i < numWorkers; i++) {
        const workerPath = path.resolve(__dirname, 'hash-worker.js');
        workers.push(new Worker(workerPath));
    }
    return workers;
}

/**
 * Terminates all workers in the pool.
 * @param {Worker[]} workerPool - The pool of workers to terminate.
 */
async function terminateWorkerPool(workerPool) {
    console.log('[DIRT] Terminating worker pool.');
    await Promise.all(workerPool.map(worker => worker.terminate()));
}

module.exports = {
    processDuplicates,
    createWorkerPool,
    terminateWorkerPool,
};