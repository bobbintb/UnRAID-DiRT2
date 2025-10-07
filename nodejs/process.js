const fs = require('fs');
const { createHash } = require('blake3');

const CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Processes a group of files to find true duplicates by performing an efficient,
 * incremental comparison using direct buffer comparison, and updating persistent
 * hashers only when necessary.
 *
 * @param {object[]} initialGroup An array of file objects that have the same size.
 * @param {number} size The size of the files in the group.
 */
async function processDuplicates(initialGroup, size) {
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
                    const buffer = Buffer.alloc(currentChunkSize);
                    const { bytesRead: read } = await handle.read(buffer, 0, currentChunkSize, bytesRead);

                    if (read === 0) continue;

                    const actualBuffer = read < currentChunkSize ? buffer.slice(0, read) : buffer;

                    // Update the persistent hasher for the file.
                    fileInfo.hasher.update(actualBuffer);

                    // To get an intermediate hash for comparison, we clone the persistent hasher
                    // and call digest() on the clone. This avoids finalizing the main hasher.
                    const intermediateHash = fileInfo.hasher.clone().digest('hex');

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
        console.log(`[DIRT] Finished processing group for size ${size}.`);
    }
}

module.exports = { processDuplicates };