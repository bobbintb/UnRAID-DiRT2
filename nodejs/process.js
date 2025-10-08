const fs = require('fs');
const blake3 = require('blake3');

const CHUNK_SIZE = 1024 * 1024; // 1MB

// Create a promise that resolves with the createHash function once blake3 is loaded.
const getCreateHash = (async () => {
    await blake3.load();
    return blake3.createHash;
})();

/**
 * Initializes a Map with file information, including a hasher instance for each file.
 * @param {object[]} initialGroup - The initial group of files.
 * @param {function} createHash - The blake3 createHash function.
 * @returns {Map<string, object>} A map from inode to file info.
 */
function initializeFileInfo(initialGroup, createHash) {
    const fileInfoMap = new Map();
    initialGroup.forEach(file => {
        fileInfoMap.set(file.ino, { fileObject: file, hasher: createHash() });
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
 * Processes one chunk of data for a set of file groups, refining the groups based on intermediate hashes.
 * @param {Array<Array<object>>} activeGroups - The current groups of potential duplicates.
 * @param {Map<string, fs.promises.FileHandle>} fileHandles - A map of file handles.
 * @param {Buffer} buffer - The buffer to use for reading file chunks.
 * @param {number} currentChunkSize - The size of the chunk to read.
 * @param {number} bytesRead - The offset where to start reading.
 * @returns {Promise<Array<Array<object>>>} The refined groups for the next iteration.
 */
async function processChunk(activeGroups, fileHandles, buffer, currentChunkSize, bytesRead) {
    const nextIterationGroups = [];

    for (const currentGroup of activeGroups) {
        if (currentGroup.length <= 1) continue;

        const hashesThisRound = new Map(); // Map<intermediateHash, fileInfo[]>

        for (const fileInfo of currentGroup) {
            const handle = fileHandles.get(fileInfo.fileObject.ino);
            const { bytesRead: read } = await handle.read(buffer, 0, currentChunkSize, bytesRead);

            if (read === 0) continue;

            const actualBuffer = buffer.slice(0, read);
            fileInfo.hasher.update(actualBuffer);
            const intermediateHash = fileInfo.hasher.digest('hex');

            if (!hashesThisRound.has(intermediateHash)) {
                hashesThisRound.set(intermediateHash, []);
            }
            hashesThisRound.get(intermediateHash).push(fileInfo);
        }

        for (const subGroup of hashesThisRound.values()) {
            if (subGroup.length > 1) {
                nextIterationGroups.push(subGroup);
            }
        }
    }
    return nextIterationGroups;
}

/**
 * Finalizes the process by assigning the definitive hash to all files in confirmed duplicate groups.
 * @param {Array<Array<object>>} finalGroups - The groups of confirmed duplicate files.
 */
function finalizeHashes(finalGroups) {
    if (finalGroups.length > 0) {
        console.log('[DIRT] Incremental comparison complete. Finalizing hashes...');
        for (const finalGroup of finalGroups) {
            if (finalGroup.length > 1) {
                const finalHash = finalGroup[0].hasher.digest('hex');
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
async function processDuplicates(initialGroup, size) {
    const createHash = await getCreateHash;
    console.log(`[DIRT] Starting definitive incremental comparison for group of ${initialGroup.length} files with size ${size}.`);

    const fileInfoMap = initializeFileInfo(initialGroup, createHash);
    let activeGroups = [Array.from(fileInfoMap.values())];
    const fileHandles = await openFileHandles(initialGroup);

    try {
        const buffer = Buffer.alloc(CHUNK_SIZE);
        let bytesRead = 0;

        while (activeGroups.length > 0 && bytesRead < size) {
            const currentChunkSize = Math.min(CHUNK_SIZE, size - bytesRead);
            activeGroups = await processChunk(activeGroups, fileHandles, buffer, currentChunkSize, bytesRead);
            bytesRead += currentChunkSize;

            if (activeGroups.length > 0) {
                const totalFiles = activeGroups.reduce((sum, group) => sum + group.length, 0);
                console.log(`[DIRT] Chunk comparison complete. ${totalFiles} potential duplicates remain in ${activeGroups.length} group(s).`);
            } else {
                break;
            }
        }

        finalizeHashes(activeGroups);

    } catch (error) {
        console.error(`[DIRT] Error during incremental comparison for size ${size}:`, error);
    } finally {
        for (const handle of fileHandles.values()) {
            await handle.close();
        }
        console.log(`[DIRT] Finished processing group for size ${size}.`);
    }
}

module.exports = { processDuplicates };