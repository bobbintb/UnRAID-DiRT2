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
      await fileRepository.saveAll(filesToSave);
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

    // Start with a single list containing one group of all files.
    let activeGroups = [Array.from(fileInfoMap.values())];
    const fileHandles = new Map();

    try {
        // Open file handles for all files.
        for (const file of initialGroup) {
            const handle = await fs.promises.open(file.path[0], 'r');
            fileHandles.set(file.ino, handle);
        }

        const buffer = Buffer.alloc(CHUNK_SIZE);
        let bytesRead = 0;
        while (activeGroups.length > 0 && bytesRead < size) {
            const currentChunkSize = Math.min(CHUNK_SIZE, size - bytesRead);
            const nextIterationGroups = [];

            // Process each group from the previous iteration.
            for (const currentGroup of activeGroups) {
                if (currentGroup.length <= 1) continue;

                const hashesThisRound = new Map(); // Map<intermediateHash, fileInfo[]>

                // Read the next chunk and calculate intermediate hash for each file in the current group.
                for (const fileInfo of currentGroup) {
                    const handle = fileHandles.get(fileInfo.fileObject.ino);
                    const { bytesRead: read } = await handle.read(buffer, 0, currentChunkSize, bytesRead);

                    if (read === 0) continue;

                    // Since we are reusing a single large buffer, we must slice it to the actual number of bytes
                    // read to avoid processing old data from a previous, larger read operation.
                    const actualBuffer = buffer.slice(0, read);

                    // Update the persistent hasher for the file.
                    fileInfo.hasher.update(actualBuffer);

                    // To get an intermediate hash for comparison, we can call digest() directly.
                    // The blake3 hasher can be updated again afterwards, so no clone is needed.
                    const intermediateHash = fileInfo.hasher.digest('hex');

                    if (!hashesThisRound.has(intermediateHash)) {
                        hashesThisRound.set(intermediateHash, []);
                    }
                    hashesThisRound.get(intermediateHash).push(fileInfo);
                }

                // For each group of matching intermediate hashes, if the group contains more than one file,
                // it's a candidate for the next round of comparison.
                for (const subGroup of hashesThisRound.values()) {
                    if (subGroup.length > 1) {
                        nextIterationGroups.push(subGroup);
                    }
                }
            }

            bytesRead += currentChunkSize;
            activeGroups = nextIterationGroups;

            if (activeGroups.length > 0) {
                 const totalFiles = activeGroups.reduce((sum, group) => sum + group.length, 0);
                 console.log(`[DIRT] Chunk comparison complete. ${totalFiles} potential duplicates remain in ${activeGroups.length} group(s).`);
            } else {
                break; // No more potential duplicates.
            }
        }

        // If any groups survived the entire process, they are confirmed duplicates.
        if (activeGroups.length > 0) {
            console.log('[DIRT] Incremental comparison complete. Finalizing hashes...');
            for (const finalGroup of activeGroups) {
                if (finalGroup.length > 1) {
                    // All files in this final group are identical. Call digest() on the first one's hasher.
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

    } catch (error) {
        console.error(`[DIRT] Error during incremental comparison for size ${size}:`, error);
    } finally {
        // Ensure all file handles are closed.
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