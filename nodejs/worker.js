const { Worker } = require('bullmq');
// handlers.js will be created in a subsequent step and will contain the job processing logic.
const handlers = require('./handlers.js');
// The worker pool logic will also be moved to the new handlers file.
const { createWorkerPool, terminateWorkerPool } = require('./handlers.js');

const { fileProcessingQueue } = require('./redis.js');
const { sharedEmitter } = require('./events.js');

const connection = {
  host: 'localhost',
  port: 6379
};

// Create a persistent worker pool to be used by all jobs.
const workerPool = createWorkerPool();

const worker = new Worker('file-processing', async (job) => {
  console.log(`[WORKER] Received job ${job.id} of type ${job.name}`);

  switch (job.name) {
    case 'file-group':
      await handlers.handleFileGroup(job, workerPool);
      break;
    case 'file.upsert':
      await handlers.handleUpsert(job);
      break;
    case 'file.removed':
      await handlers.handleRemoved(job);
      break;
    case 'file.moved':
      await handlers.handleMoved(job);
      break;
    default:
      console.error(`[WORKER] Unknown job name: ${job.name}`);
      throw new Error(`Unknown job name: ${job.name}`);
  }
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