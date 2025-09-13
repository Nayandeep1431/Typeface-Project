const Queue = require('bull');
const redis = require('redis');
const { processRecurringTransactions } = require('./recurringProcessor');
const { sendScheduledNotifications } = require('./notificationService');
const { processOCRFile } = require('./ocrService');

// Create Redis client
const redisClient = redis.createClient(process.env.REDIS_URL);

// Create job queues
const recurringQueue = new Queue('recurring transactions', process.env.REDIS_URL);
const notificationQueue = new Queue('notifications', process.env.REDIS_URL);
const ocrQueue = new Queue('ocr processing', process.env.REDIS_URL);

// Process recurring transactions job
recurringQueue.process('process-recurring', async (job) => {
  console.log('Processing recurring transactions...');
  return await processRecurringTransactions();
});

// Process notifications job
notificationQueue.process('send-notifications', async (job) => {
  console.log('Sending scheduled notifications...');
  return await sendScheduledNotifications();
});

// Process OCR job
ocrQueue.process('process-ocr', async (job) => {
  const { fileId, filePath, userId } = job.data;
  console.log(`Processing OCR for file: ${fileId}`);
  return await processOCRFile(fileId, filePath, userId);
});

// Schedule recurring jobs
const initializeJobQueue = () => {
  // Process recurring transactions every hour
  recurringQueue.add('process-recurring', {}, {
    repeat: { cron: '0 * * * *' }, // Every hour
    removeOnComplete: 5,
    removeOnFail: 10
  });

  // Send notifications every 5 minutes
  notificationQueue.add('send-notifications', {}, {
    repeat: { cron: '*/5 * * * *' }, // Every 5 minutes
    removeOnComplete: 5,
    removeOnFail: 10
  });

  console.log('Job queues initialized');
};

// Add OCR job
const addOCRJob = (fileId, filePath, userId) => {
  return ocrQueue.add('process-ocr', { fileId, filePath, userId }, {
    removeOnComplete: 5,
    removeOnFail: 10,
    attempts: 3,
    backoff: 'exponential'
  });
};

module.exports = {
  initializeJobQueue,
  addOCRJob,
  recurringQueue,
  notificationQueue,
  ocrQueue
};
