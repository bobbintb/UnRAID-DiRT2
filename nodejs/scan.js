const fs = require('fs').promises;
const path = require('path');
const { processDuplicates } = require('./process.js');

/**
 * Retrieves statistics for a single file.
 *
 * @param {string} fullPath The full path to the file.
 * @returns {Promise<object|null>} A Promise that resolves to an object containing file stats
 * (`ino`, `size`, `nlink`, `atime`, `mtime`, `ctime`), or `null` if an error occurs.
 */
async function getFileStats(fullPath) {
  try {
    const stats = await fs.stat(fullPath, { bigint: true });
    return {
      ino: stats.ino.toString(),
      size: Number(stats.size),
      nlink: Number(stats.nlink),
      atime: stats.atime,
      mtime: stats.mtime,
      ctime: stats.ctime,
    };
  } catch (error) {
    console.error(`[DIRT] Error stating file ${fullPath}:`, error.message);
    return null;
  }
}

/**
 * Processes a single file, adding it to the filesBySize Map.
 * It correctly handles hard links by checking the inode number.
 *
 * @param {string} fullPath The full path to the file.
 * @param {Map<number, object[]>} filesBySize The map grouping files by size.
 */
async function processFile(fullPath, filesBySize) {
  console.log(`[DIRT] Processing file: ${fullPath}`);
  const stats = await getFileStats(fullPath);
  if (!stats) {
    return; // Error was already logged in getFileStats
  }

  const { ino, size, nlink, atime, mtime, ctime } = stats;
  const fileList = filesBySize.get(size);

  if (!fileList) {
    // This is the first file found of this specific size.
    console.log(`[DIRT] Creating new size group for size ${size} with file: ${fullPath}`);
    const newFileObject = { ino, path: [fullPath], nlink, atime, mtime, ctime };
    filesBySize.set(size, [newFileObject]);
  } else {
    // Other files of this size already exist. Check for a hard link.
    let foundHardLink = false;
    for (const file of fileList) {
      if (file.ino === ino) {
        // Found a hard link. The inode number matches.
        console.log(`[DIRT] Found hard link for inode ${ino}. Adding path: ${fullPath}`);
        file.path.push(fullPath);
        foundHardLink = true;
        break;
      }
    }

    if (!foundHardLink) {
      // It's a different file that just happens to be the same size.
      console.log(`[DIRT] Found new file with existing size ${size} but different inode: ${fullPath}`);
      const newFileObject = { ino, path: [fullPath], nlink, atime, mtime, ctime };
      fileList.push(newFileObject);
    }
  }
}

/**
 * Recursively traverses a directory.
 * @param {string} directory The path of the directory to traverse.
 * @param {Map<number, object[]>} filesBySize The map to populate with file data.
 */
async function traverse(directory, filesBySize) {
  console.log(`[DIRT] Traversing directory: ${directory}`);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    console.error(`[DIRT] Error reading directory ${directory}:`, error.message);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await traverse(fullPath, filesBySize);
    } else if (entry.isFile()) {
      await processFile(fullPath, filesBySize);
    }
  }
}

/**
 * Scans directories recursively, groups files by their exact size, and handles hard links.
 *
 * @param {string[]} paths An array of absolute paths to start scanning from.
 * @returns {Promise<Map<number, object[]>>} A Promise that resolves to a Map of files grouped by size.
 */
async function scan(paths) {
  const filesBySize = new Map();

  for (const p of paths) {
    console.log(`[DIRT] Starting scan for root path: ${p}`);
    try {
      const stats = await fs.stat(p);
      if (stats.isDirectory()) {
        await traverse(p, filesBySize);
      } else {
        console.error(`[DIRT] Provided path is not a directory: ${p}`);
      }
    } catch (error) {
      console.error(`[DIRT] Error accessing path ${p}:`, error.message);
    }
  }

  console.log('[DIRT] Scan complete. Processing potential duplicates...');

  let groupsFound = 0;
  for (const [size, files] of filesBySize.entries()) {
    if (files.length > 1) {
      groupsFound++;
      await processDuplicates(files, size);
    }
  }

  if (groupsFound > 0) {
    console.log(`[DIRT] Finished processing ${groupsFound} groups of potential duplicates.`);
  } else {
    console.log('[DIRT] No potential duplicates found to process.');
  }

  return filesBySize;
}

module.exports = { scan };