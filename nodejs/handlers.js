const fs = require('fs');
const { getFileMetadataRepository, getRedisPublisherClient } = require('./redis.js');
const { getShareFromPath } = require('./utils.js');

const handleUpsert = async (job) => {
  console.log(`[HANDLER] Processing file.upsert job ${job.id} for path: ${job.data.path}`);
};

const handleRemoved = async (job) => {
  const { path: removedPath } = job.data;
  console.log(`[HANDLER] Processing file.removed job ${job.id} for path: ${removedPath}`);

  try {
    // 1. Publish cancellation signal immediately.
    const pubClient = getRedisPublisherClient();
    const channel = `cancel-hashing:${removedPath}`;
    await pubClient.publish(channel, 'cancel');
    console.log(`[HANDLER] Published cancellation signal to ${channel}`);

    // 2. Search for the file record by its path, getting all results.
    const fileRepository = getFileMetadataRepository();
    const fileEntities = await fileRepository.search().where('path').contains(removedPath).return.all();

    // 3. If no record is found, log and exit gracefully.
    if (!fileEntities || fileEntities.length === 0) {
      console.warn(`[HANDLER] Received 'remove' event for a path not in the database: ${removedPath}. No action taken.`);
      return;
    }

    const fileEntity = fileEntities[0]; // Use the first result
    // The entityId is stored in a symbol property. Find it by its description.
    const entityIdSymbol = Object.getOwnPropertySymbols(fileEntity).find(s => s.description === 'entityId');
    const ino = entityIdSymbol ? fileEntity[entityIdSymbol] : null;

    if (!ino) {
      console.error(`[HANDLER] Could not retrieve entity ID (ino) for path ${removedPath}. The record may be malformed. Aborting removal.`);
      return;
    }

    // 4. Check if the file has multiple paths (is a hard link).
    if (fileEntity.path.length <= 1) {
      // This is the last path, remove the entire entity.
      await fileRepository.remove(ino);
      console.log(`[HANDLER] File entity ${ino} had one path. Deleted entity.`);
    } else {
      // This is a hard link; remove only this path.
      const pathIndex = fileEntity.path.indexOf(removedPath);
      if (pathIndex > -1) {
        fileEntity.path.splice(pathIndex, 1);
        // Also remove the corresponding share.
        if (fileEntity.shares && fileEntity.shares.length > pathIndex) {
          fileEntity.shares.splice(pathIndex, 1);
        }
        await fileRepository.save(fileEntity);
        console.log(`[HANDLER] Removed path '${removedPath}' from entity ${ino}. ${fileEntity.path.length} paths remain.`);
      } else {
        console.warn(`[HANDLER] Path '${removedPath}' not found in record ${ino}, despite being found by search. No action taken.`);
      }
    }
  } catch (error) {
    console.error(`[HANDLER] Error processing file.removed job for path ${removedPath}:`, error);
    throw error;
  }
};

const handleMoved = async (job) => {
  const { oldPath, newPath } = job.data;
  console.log(`[HANDLER] Processing file.moved job ${job.id} from ${oldPath} to ${newPath}`);

  try {
    // 1. Get the inode from the new path.
    const stats = await fs.promises.stat(newPath, { bigint: true });
    const ino = stats.ino.toString();

    // 2. Fetch the record from Redis using the inode.
    const fileRepository = getFileMetadataRepository();
    const fileEntity = await fileRepository.fetch(ino);

    if (!fileEntity) {
      console.error(`[HANDLER] Could not find file record in Redis for ino: ${ino} (path: ${newPath})`);
      // No point in continuing if the record doesn't exist.
      // This might happen if the event is processed before the initial scan creates the record.
      return;
    }

    // 3. Update the path array.
    const pathIndex = fileEntity.path.indexOf(oldPath);
    if (pathIndex > -1) {
      fileEntity.path[pathIndex] = newPath;
    } else {
      // This could happen if the file was moved again before this job was processed.
      // We'll add the new path to ensure the record is up-to-date.
      console.warn(`[HANDLER] oldPath ${oldPath} not found in path array for ino ${ino}. Adding new path.`);
      fileEntity.path.push(newPath);
    }

    // 4. For robustness, always rebuild the shares array from the paths array.
    // This ensures they remain perfectly synchronized.
    fileEntity.shares = fileEntity.path.map(getShareFromPath).filter(share => share !== null);


    // 5. Save the updated record back to Redis.
    await fileRepository.save(fileEntity);
    console.log(`[HANDLER] Successfully updated path for ino ${ino}. New path: ${newPath}`);

  } catch (error) {
    console.error(`[HANDLER] Error processing file.moved job for ${newPath}:`, error);
    // Re-throw the error to allow BullMQ to handle the job failure (e.g., retry).
    throw error;
  }
};

module.exports = {
    handleUpsert,
    handleRemoved,
    handleMoved,
};