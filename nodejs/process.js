const fs = require('fs');
const blake3 = require('blake3');
const { getFileMetadataRepository } = require('./redis.js');

const CHUNK_SIZE = 1024 * 1024; // 1MB

// Create a promise that resolves with the createHash function once blake3 is loaded.
// This ensures that blake3.load() is only called once, the first time this module is required.
const getCreateHash = (async () => {
    await blake3.load();
    return blake3.createHash;
})();

/**
 * A helper function to save file metadata to Redis with a retry mechanism.
 * @param {object[]} filesToSave An array of file objects to save.
 */
async function saveWithRetries(filesToSave) {
  if (filesToSave.length === 0) return;

  const fileRepository = getFileMetadataRepository();
  const maxRetries = 3;
  const delay = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DIRT] Attempt ${attempt}: Saving ${filesToSave.length} processed file(s) to Redis...`);
      // Use Promise.all to save files concurrently, which is more performant.
      await Promise.all(filesToSave.map(file => {
        const { ino, ...fileData } = file;
        return fileRepository.save(ino, fileData);
      }));
      console.log('[DIRT] Successfully saved processed files to Redis.');
      return; // Success, exit the function
    } catch (error) {
      console.error(`[DIRT] Attempt ${attempt} failed to save processed files to Redis:`, error.message);
      if (attempt < maxRetries) {
        console.log(`[DIRT] Retrying in ${delay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error('[DIRT] All retry attempts failed. Could not save processed files to Redis.');
        // As per requirements, we log the error and allow the job to complete.
      }
    }
  }
}

/**
 * Opens file handles for a list of files concurrently.
 * @param {object[]} files - An array of file objects.
 * @returns {Promise<Map<string, fs.promises.FileHandle>>} A map of inode numbers to file handles.
 */
async function openFileHandles(files) {
    const fileHandles = new Map();
    const openPromises = files.map(async (file) => {
        const handle = await fs.promises.open(file.path[0], 'r');
        fileHandles.set(file.ino, handle);
    });
    await Promise.all(openPromises);
    return fileHandles;
}

/**
 * Processes one chunk of data for a set of active file groups to identify subgroups
 * with matching intermediate hashes.
 * @param {Array<Array<object>>} activeGroups - The current groups of potential duplicates.
 * @param {Map<string, fs.promises.FileHandle>} fileHandles - A map of inode numbers to open file handles.
 * @param {Buffer} buffer - The buffer to use for reading file chunks.
 * @param {number} chunkSize - The size of the chunk to read.
 * @param {number} bytesRead - The offset in the files to start reading from.
 * @returns {Promise<Array<Array<object>>>} The next iteration of active groups.
 */
async function processSingleChunk(activeGroups, fileHandles, buffer, chunkSize, bytesRead) {
    const nextIterationGroups = [];

    for (const currentGroup of activeGroups) {
        if (currentGroup.length <= 1) continue;

        const hashesThisRound = new Map(); // Map<intermediateHash, fileInfo[]>

        for (const fileInfo of currentGroup) {
            const handle = fileHandles.get(fileInfo.fileObject.ino);
            const { bytesRead: read } = await handle.read(buffer, 0, chunkSize, bytesRead);

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
 * Finalizes the hashing process for confirmed duplicate groups.
 * @param {Array<Array<object>>} finalGroups - The groups of files confirmed to be duplicates.
 */
function finalizeDuplicateGroups(finalGroups) {
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
    // Await the initialization promise to get the createHash function.
    const createHash = await getCreateHash;

    console.log(`[DIRT] Starting definitive incremental comparison for group of ${initialGroup.length} files with size ${size}.`);

    // Map<ino, { fileObject: object, hasher: Hasher }>
    const fileInfoMap = new Map();
    initialGroup.forEach(file => {
        fileInfoMap.set(file.ino, { fileObject: file, hasher: createHash() });
    });

    let activeGroups = [Array.from(fileInfoMap.values())];
    const fileHandles = await openFileHandles(initialGroup);

    try {
        const buffer = Buffer.alloc(CHUNK_SIZE);
        let bytesRead = 0;

        while (activeGroups.length > 0 && bytesRead < size) {
            const currentChunkSize = Math.min(CHUNK_SIZE, size - bytesRead);

            activeGroups = await processSingleChunk(activeGroups, fileHandles, buffer, currentChunkSize, bytesRead);

            bytesRead += currentChunkSize;

            if (activeGroups.length > 0) {
                const totalFiles = activeGroups.reduce((sum, group) => sum + group.length, 0);
                console.log(`[DIRT] Chunk comparison complete. ${totalFiles} potential duplicates remain in ${activeGroups.length} group(s).`);
            } else {
                break; // No more potential duplicates.
            }
        }

        finalizeDuplicateGroups(activeGroups);

    } catch (error) {
        console.error(`[DIRT] Error during incremental comparison for size ${size}:`, error);
    } finally {
        for (const handle of fileHandles.values()) {
            await handle.close();
        }
        console.log(`[DIRT] Finished hashing group for size ${size}.`);
    }

    // After processing, prepare all files from the original group to be saved.
    // This includes files that were confirmed as duplicates (with a hash) and those
    // that were unique within the group (without a hash).
    const filesToSave = Array.from(fileInfoMap.values()).map(info => ({
        ...info.fileObject,
        size // Add the size back, as it's part of the schema but not the file object.
    }));

    await saveWithRetries(filesToSave);
    console.log(`[DIRT] Finished processing and saving data for group size ${size}.`);
}

module.exports = { processDuplicates };