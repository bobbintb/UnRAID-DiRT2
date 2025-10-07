const fs = require('fs');
const { createHash } = require('blake3');

const CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Processes a group of files to find true duplicates by performing a true
 * incremental hash comparison using a non-finalizing digest.
 *
 * @param {object[]} initialGroup An array of file objects that have the same size.
 * @param {number} size The size of the files in the group.
 */
async function processDuplicates(initialGroup, size) {
    console.log(`[DIRT] Starting final, correct incremental hash for group of ${initialGroup.length} files with size ${size}.`);

    // Map<ino, { fileObject: object, hasher: Hasher, finalHash: string }>
    const fileInfoMap = new Map();
    initialGroup.forEach(file => {
        fileInfoMap.set(file.ino, { fileObject: file, hasher: createHash(), finalHash: null });
    });

    let activeGroups = [Array.from(fileInfoMap.values())];
    const fileHandles = new Map();

    try {
        // Open file handles for all files.
        for (const file of initialGroup) {
            const handle = await fs.promises.open(file.path[0], 'r');
            fileHandles.set(file.ino, handle);
        }

        let bytesRead = 0;
        while (activeGroups.length > 0 && bytesRead < size) {
            const currentChunkSize = Math.min(CHUNK_SIZE, size - bytesRead);
            const nextIterationGroups = [];

            for (const currentGroup of activeGroups) {
                if (currentGroup.length <= 1) continue;

                const hashesThisRound = new Map();

                for (const fileInfo of currentGroup) {
                    const handle = fileHandles.get(fileInfo.fileObject.ino);
                    const buffer = Buffer.alloc(currentChunkSize);
                    const { bytesRead: read } = await handle.read(buffer, 0, currentChunkSize, bytesRead);

                    if (read === 0) continue;

                    const actualBuffer = read < currentChunkSize ? buffer.slice(0, read) : buffer;

                    // Update the hasher and get the intermediate digest.
                    fileInfo.hasher.update(actualBuffer);
                    const intermediateHash = fileInfo.hasher.digest('hex');

                    // Store the latest hash, which will be the final hash if this is the last chunk.
                    fileInfo.finalHash = intermediateHash;

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

            bytesRead += currentChunkSize;
            activeGroups = nextIterationGroups;

            if (activeGroups.length > 0) {
                 const totalFiles = activeGroups.reduce((sum, group) => sum + group.length, 0);
                 console.log(`[DIRT] Chunk comparison complete. ${totalFiles} potential duplicates remain in ${activeGroups.length} group(s).`);
            } else {
                break;
            }
        }

        if (activeGroups.length > 0) {
            console.log('[DIRT] Incremental hashing complete. Assigning final hashes...');
            for (const finalGroup of activeGroups) {
                if (finalGroup.length > 1) {
                    // The final hash is the last intermediate hash calculated for the group.
                    const finalHash = finalGroup[0].finalHash;
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
        console.error(`[DIRT] Error during incremental hash for size ${size}:`, error);
    } finally {
        for (const handle of fileHandles.values()) {
            await handle.close();
        }
        console.log(`[DIRT] Finished processing group for size ${size}.`);
    }
}

module.exports = { processDuplicates };