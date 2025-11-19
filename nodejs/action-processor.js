const fs = require('fs').promises;
const { actionQueue, getRedisClient } = require('./redis');
const { findFileByPath, findFileByIno, findHashByIno } = require('./redisFunctions');

/**
 * Processes all waiting jobs in the action queue.
 *
 * @returns {Promise<Object>} A summary of the actions taken and any errors.
 */
async function processActionQueue() {
  const redisClient = getRedisClient();
  const waitingJobs = await actionQueue.getWaiting();
  const results = {
    processed: [],
    failed: [],
  };

  for (const job of waitingJobs) {
    try {
      const { path: duplicateFilePath } = job.data;
      const ino = job.id.replace('ino-', '');

      // 1. Find the hash for the given ino.
      const hash = await findHashByIno(ino);
      if (!hash) {
        throw new Error(`Could not find hash for ino ${ino}`);
      }

      // 2. Find the designated original file's ino from the 'state' hash.
      const originalFileIno = await redisClient.hGet('state', hash);
      if (!originalFileIno) {
        throw new Error(`No original file designated for file group with hash ${hash}`);
      }

      // 3. Get the original file's path from its ino.
      const originalFile = await findFileByIno(originalFileIno);
      if (!originalFile || !originalFile.paths || originalFile.paths.length === 0) {
        throw new Error(`Could not find path for original file with ino ${originalFileIno}`);
      }
      const originalFilePath = originalFile.paths[0]; // Assuming one path per file

      // 4. Check if the original file exists on the filesystem.
      try {
        await fs.access(originalFilePath);
      } catch (error) {
        throw new Error(`Original file does not exist at path: ${originalFilePath}`);
      }

      // 5. If original exists, perform the stubbed action.
      const action = job.name.toUpperCase();
      console.log(`[ACTION-PROCESSOR] Stubbed action: ${action} on '${duplicateFilePath}' using original '${originalFilePath}'`);

      results.processed.push({
        jobId: job.id,
        action: job.name,
        path: duplicateFilePath,
        original: originalFilePath,
      });
      // In a real scenario, you would remove the job after successful processing.
      // await job.remove();

    } catch (error) {
      console.error(`[ACTION-PROCESSOR] Failed to process job ${job.id}:`, error.message);
      results.failed.push({
        jobId: job.id,
        action: job.name,
        path: job.data.path,
        error: error.message,
      });
    }
  }

  // For this scaffolding task, we are not removing the jobs from the queue.
  // In a real implementation, you would likely remove them upon success
  // and handle failures (e.g., move to a failed queue).

  console.log('[ACTION-PROCESSOR] Finished processing queue batch.');
  return results;
}

module.exports = { processActionQueue };
