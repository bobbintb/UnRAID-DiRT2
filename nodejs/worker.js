const { Worker } = require('bullmq');
const { processDuplicates, createWorkerPool, terminateWorkerPool } = require('./process.js');
const { fileProcessingQueue } = require('./queue.js');
const { sharedEmitter } = require('./events.js');

const connection = {
  host: 'localhost',
  port: 6379
};

// Create a persistent worker pool to be used by all jobs.
const workerPool = createWorkerPool();

const worker = new Worker('file-processing', async job => {
  const { files, size } = job.data;
  console.log(`[WORKER] Processing job ${job.id} for file group of size ${size}`);
  // Pass the persistent worker pool to the job processor.
  await processDuplicates(files, size, workerPool);
}, { connection });

// Gracefully shut down the worker pool when the process is terminated.
const gracefulShutdown = async () => {
  console.log('[WORKER] Shutting down...');
  await terminateWorkerPool(workerPool);
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


// This function checks if the queue is idle and emits an event.
const checkQueueIdle = async () => {
  const waiting = await fileProcessingQueue.getWaitingCount();
  const active = await fileProcessingQueue.getActiveCount();

  if (waiting === 0 && active === 0) {
    console.log('[WORKER] All jobs have been processed. Emitting queueIdle event.');
    sharedEmitter.emit('queueIdle');
  }
};

worker.on('completed', async (job) => {
  console.log(`[WORKER] Job ${job.id} has completed.`);
  await checkQueueIdle();
});

worker.on('failed', async (job, err) => {
  console.error(`[WORKER] Job ${job.id} has failed with error: ${err.message}`);
  await checkQueueIdle(); // Also check if idle on failure
});

module.exports = worker;