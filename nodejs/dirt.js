const { performance } = require('perf_hooks');
const WebSocket = require('ws');
const fs = require('fs').promises;
const crypto = require('crypto');
const { scan } = require('./scan.js');
const { createClient } = require('redis');
const { connectToRedis, closeRedis, getRedisClient } = require('./redis.js');
const { fileProcessingQueue } = require('./redis.js');
const { saveDbSnapshot } = require('./snapshot.js');
const {
  debugFindFilesBySize,
  debugFindFilesWithMultiplePaths,
  debugFindFilesWithNonUniqueHashes,
  debugFindFileByPath,
} = require('./debug.js');
const { getAllFiles, findDuplicates } = require('./redis.js');

let inboxListenerClient;

const getPathFromEvent = (pathInfo) => {
  if (!pathInfo || !pathInfo.share || !pathInfo.relative_path) {
    return null;
  }
  return `/mnt/user/${pathInfo.share}/${pathInfo.relative_path}`;
};

async function startInboxListener() {
  // A dedicated client is needed for blocking commands like BRPOP
  inboxListenerClient = createClient({ url: 'redis://localhost:6379' });
  await inboxListenerClient.connect();
  console.log('[DIRT] Inbox listener connected to Redis.');

  // The '0' timeout means it will block indefinitely until an item is available.
  const inboxKey = 'dirt-events';
  const timeout = 0;

  while (true) {
    try {
      const result = await inboxListenerClient.brPop(inboxKey, timeout);
      // brPop returns an object like { key: 'dirt-inbox', element: '...' }
      if (result) {
        const message = result.element;
        console.log(`[DIRT] Received event from '${inboxKey}':`, message);
        const fs_event = JSON.parse(message);

        // --- New Validation and Path Construction ---
        if (!fs_event.event || !fs_event.src) {
          console.error('[DIRT] Invalid event received. Missing "event" or "src" property:', fs_event);
          continue;
        }

        const allowedEvents = ['upsert', 'remove', 'rename'];
        if (!allowedEvents.includes(fs_event.event)) {
          console.error(`[DIRT] Unknown event received from inbox: ${fs_event.event}`);
          continue;
        }

        const srcPath = getPathFromEvent(fs_event.src);
        if (!srcPath) {
          console.error('[DIRT] Invalid "src" data in event:', fs_event);
          continue;
        }

        let jobPayload;
        let groupId = srcPath; // Use srcPath for sequential processing
        let logPath = srcPath;

        if (fs_event.event === 'rename') {
          const tgtPath = getPathFromEvent(fs_event.tgt);
          if (!tgtPath) {
            console.error('[DIRT] Invalid "tgt" data in rename event:', fs_event);
            continue;
          }
          jobPayload = { oldPath: srcPath, newPath: tgtPath };
          logPath = `${srcPath} -> ${tgtPath}`;
        } else { // 'upsert' or 'remove'
          jobPayload = { path: srcPath };
        }
        // --- End of New Logic ---

        // Add the job to the queue, using the file path as the groupId
        // to ensure sequential processing for the same file.
        await fileProcessingQueue.add(fs_event.event, jobPayload, {
          groupId: groupId,
        });

        console.log(`[DIRT] Queued job '${fs_event.event}' for path '${logPath}' from inbox.`);
      }
    } catch (error) {
      // If brPop times out or if there's a connection issue, it might throw.
      // Also handles JSON parsing errors.
      console.error('[DIRT] Error processing message from dirt-inbox:', error);
      // Add a small delay before retrying to prevent a tight error loop in case of connection issues.
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  try {
    // Establish the connection to Redis and get the repository
    await connectToRedis();
    console.log('[DIRT] Successfully connected to Redis.');

    // --- CONDITIONAL STARTUP ---
    // Check if the initial scan has been completed before.
    // We do this by checking for the existence of any file data.
    const redisClient = getRedisClient();
    const { keys } = await redisClient.scan(0, { MATCH: 'ino:*', COUNT: 1 });

    if (keys.length > 0) {
      // Data exists, so start the listener immediately.
      console.log('[DIRT] Existing data found. Starting real-time event listener.');
      startInboxListener();
    } else {
      // No data, this is a fresh install.
      console.log('[DIRT] No existing data found. Waiting for initial scan to be triggered.');
    }

    // Now that Redis is connected, start the worker and the WebSocket server.
    require('./worker.js'); // This will start the worker process

    const port = 41820;
    const wss = new WebSocket.Server({ port });

    console.log(`[DIRT] WebSocket server started on port ${port}`);

    wss.on('connection', ws => {
      console.log('[DIRT] Client connected.');

      ws.on('message', async (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          const { action, data, clientId } = parsedMessage;

          console.log(`[DIRT] Received action '${action}' from client '${clientId}' with data:`, data);

          switch (action) {
            case 'scan': {
              console.log(`[DIRT] Scan initiated for shares: ${data.join(', ')}`);
              const redisClient = getRedisClient();
              const { keys } = await redisClient.scan(0, { MATCH: 'ino:*', COUNT: 1 });

              if (keys.length === 0) {
                // --- INITIAL SCAN LOGIC ---
                console.log('[DIRT] This is the initial scan. Applying special lifecycle management.');
                await fileProcessingQueue.pause();
                console.log('[DIRT] File processing queue PAUSED.');

                console.log('[DIRT] Starting real-time event listener for the first time.');
                startInboxListener(); // Runs in the background
              } else {
                console.log('[DIRT] This is a subsequent scan. Running without special lifecycle management.');
              }

              const sharesToScan = data.map(share => ({ share, path: `/mnt/user/${share}` }));
              const startTime = performance.now();
              await scan(sharesToScan); // Await the scan to complete
              const endTime = performance.now();
              const duration = ((endTime - startTime) / 1000).toFixed(3);
              console.log(`[DIRT] Full scan completed in ${duration} seconds.`);
              break;
            }
            case 'addShare':
              // Placeholder for addShare logic
              console.log(`[DIRT] Placeholder: 'addShare' action received for: ${data.join(', ')}`);
              break;
            case 'removeShare':
              // Placeholder for removeShare logic
              console.log(`[DIRT] Placeholder: 'removeShare' action received for: ${data.join(', ')}`);
              break;
            case 'debugCreateFileAndUpsert': {
              const { path, size } = data;
              if (!path || !size || isNaN(size)) {
                console.error(`[DIRT] Invalid data for debugCreateFileAndUpsert:`, data);
                break;
              }
              try {
                const buffer = crypto.randomBytes(size);
                await fs.writeFile(path, buffer);
                console.log(`[DIRT] Successfully created file ${path} with ${size} bytes.`);
                await fileProcessingQueue.add('file.upsert', { path });
                console.log(`[DIRT] Queued 'file.upsert' job for ${path}.`);
              } catch (err) {
                console.error(`[DIRT] Error creating or queuing file for debugCreateFileAndUpsert:`, err);
              }
              break;
            }
            case 'debugUpsertExistingFile': {
              const { path } = data;
              if (!path) {
                console.error(`[DIRT] Invalid data for debugUpsertExistingFile:`, data);
                break;
              }
              try {
                await fileProcessingQueue.add('file.upsert', { path });
                console.log(`[DIRT] Queued 'file.upsert' job for existing file ${path}.`);
              } catch (err) {
                console.error(`[DIRT] Error queuing job for debugUpsertExistingFile:`, err);
              }
              break;
            }
            case 'debugFindFileByPath':
              await debugFindFileByPath(data);
              break;
            case 'debugFindFilesBySize':
              await debugFindFilesBySize(data);
              break;
            case 'debugFindFilesWithMultiplePaths':
              await debugFindFilesWithMultiplePaths();
              break;
            case 'debugFindFilesWithNonUniqueHashes':
              await debugFindFilesWithNonUniqueHashes();
              break;
            case 'saveDbSnapshot': {
              const result = await saveDbSnapshot();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  action: 'snapshotResult',
                  data: result,
                }));
              }
              break;
            }
            case 'getAllFiles': {
              const files = await getAllFiles();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  action: 'allFiles',
                  data: files,
                }));
              }
              break;
            }
            case 'findDuplicates': {
              const duplicates = await findDuplicates();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  action: 'duplicateFiles',
                  data: duplicates,
                }));
              }
              break;
            }
            default:
              console.log(`[DIRT] Received unknown action: ${action}`);
              break;
          }
        } catch (error) {
          console.error('[DIRT] Failed to parse incoming message:', message, error);
        }
      });

      ws.on('close', () => {
        console.log('[DIRT] Client disconnected.');
      });

      ws.on('error', error => {
        console.error('[DIRT] WebSocket error:', error);
      });
    });

    process.on('SIGINT', async () => {
      console.log('[DIRT] SIGINT received. Shutting down gracefully...');
      // It's important to close all connections before exiting
      if (inboxListenerClient && inboxListenerClient.isOpen) {
        await inboxListenerClient.quit();
        console.log('[DIRT] Inbox listener Redis client disconnected.');
      }
      await closeRedis();
      console.log('[DIRT] Redis connection closed.');
      wss.close(() => {
        console.log('[DIRT] WebSocket server closed.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[DIRT] Fatal error during startup:', error);
    process.exit(1);
  }
}

main();