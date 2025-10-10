const { Worker } = require('bullmq');
const { processDuplicates } = require('./process.js');
const { fileProcessingQueue } = require('./queue.js');
const { closeRedis } = require('./redis.js');

const connection = {
  host: 'localhost',
  port: 6379
};

const worker = new Worker('file-processing', async job => {
  const { files, size } = job.data;
  console.log(`[WORKER] Processing job ${job.id} for file group of size ${size}`);
  await processDuplicates(files, size);
}, { connection });

// This function checks if all jobs are done and then shuts down the system.
// This is crucial for allowing the benchmark process to exit cleanly.
const gracefulShutdown = async () => {
  const waiting = await fileProcessingQueue.getWaitingCount();
  const active = await fileProcessingQueue.getActiveCount();

  if (waiting === 0 && active === 0) {
    console.log('[WORKER] All jobs have been processed. Shutting down...');
    await worker.close();
    await fileProcessingQueue.close();
    await closeRedis();
    console.log('[WORKER] Shutdown complete.');
  }
};

worker.on('completed', async (job) => {
  console.log(`[WORKER] Job ${job.id} has completed.`);
  await gracefulShutdown();
});

worker.on('failed', async (job, err) => {
  console.error(`[WORKER] Job ${job.id} has failed with error: ${err.message}`);
  await gracefulShutdown(); // Also shutdown on failure to avoid hanging
});

module.exports = worker;