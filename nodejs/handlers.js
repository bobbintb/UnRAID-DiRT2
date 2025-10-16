const fs = require('fs');
const { getFileMetadataRepository } = require('./redis.js');
const { getShareFromPath } = require('./utils.js');

const handleUpsert = async (job) => {
  console.log(`[HANDLER] Processing file.upsert job ${job.id} for path: ${job.data.path}`);
};

const handleRemoved = async (job) => {
  console.log(`[HANDLER] Processing file.removed job ${job.id} for path: ${job.data.path}`);
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