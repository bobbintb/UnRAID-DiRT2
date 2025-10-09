const { Queue } = require('bullmq');

const connection = {
  host: 'localhost',
  port: 6379
};

const fileProcessingQueue = new Queue('file-processing', { connection });

module.exports = { fileProcessingQueue };