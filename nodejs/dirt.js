const { performance } = require('perf_hooks');
const WebSocket = require('ws');
const fs = require('fs').promises;
const crypto = require('crypto');
const { scan } = require('./scan.js');
const { createClient } = require('redis');
const { connectToRedis, closeRedis } = require('./redis.js');
const { fileProcessingQueue } = require('./queue.js');
const { saveDbSnapshot } = require('./snapshot.js');
const {
  debugFindFilesBySize,
  debugFindFilesWithMultiplePaths,
  debugFindFilesWithNonUniqueHashes
} = require('./debug.js');

async function main() {
  try {
    // Establish the connection to Redis and get the repository
    await connectToRedis();
    console.log('[DIRT] Successfully connected to Redis.');

    // Now that Redis is connected, start the worker and the WebSocket server.
    require('./worker.js'); // This will start the worker process

    // Create a dedicated Redis client for pub/sub.
    // A client in subscriber mode cannot issue any other commands.
    const subscriber = createClient({ url: 'redis://localhost:6379' });
    await subscriber.connect();
    console.log('[DIRT] Redis subscriber connected.');

    // Subscribe to the channel for external events
    await subscriber.subscribe('dirt:events', (message) => {
      try {
        const event = JSON.parse(message);
        console.log(`[DIRT] Received event from 'dirt:events':`, event);

        // Basic validation
        if (!event.eventType || !event.ino) {
          console.error('[DIRT] Invalid event received. Missing eventType or ino:', event);
          return;
        }

        const allowedEvents = ['file.upsert', 'file.removed', 'file.moved'];
        if (!allowedEvents.includes(event.eventType)) {
          console.error(`[DIRT] Unknown eventType received: ${event.eventType}`);
          return;
        }

        // Add the job to the queue, using the inode as the groupId
        // to ensure sequential processing for the same file.
        fileProcessingQueue.add(event.eventType, event, {
          groupId: event.ino.toString(), // groupId must be a string
        });

        console.log(`[DIRT] Queued job '${event.eventType}' for ino '${event.ino}'`);

      } catch (error) {
        console.error('[DIRT] Error processing message from dirt:events channel:', error);
      }
    });

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
      if (subscriber.isOpen) {
        await subscriber.quit();
        console.log('[DIRT] Redis subscriber disconnected.');
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