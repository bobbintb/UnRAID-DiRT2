const { Worker } = require('bullmq');
const { processDuplicates } = require('./process.js');

const connection = {
  host: 'localhost',
  port: 6379
};

const worker = new Worker('file-processing', async job => {
  const { files, size } = job.data;
  console.log(`[WORKER] Processing job ${job.id} for file group of size ${size}`);
  await processDuplicates(files, size);
}, { connection });

worker.on('completed', job => {
  console.log(`[WORKER] Job ${job.id} has completed.`);
});

worker.on('failed', (job, err) => {
  console.error(`[WORKER] Job ${job.id} has failed with error: ${err.message}`);
});

module.exports = worker;