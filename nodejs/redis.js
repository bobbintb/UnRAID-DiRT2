const { Client, Schema } = require("redis-om");
const { createClient } = require("redis");
const { Queue } = require("bullmq");
const fs = require("fs").promises;
const path = require("path");
const redisFunctions = require("./redisFunctions");
const broadcaster = require('./broadcaster');

let redisClient;
let redisPublisherClient;
let redisSubscriberClient;
let omClient;
let fileMetadataRepository;
let findWithMultiplePathsScriptSha;
let findWithNonUniqueHashesScriptSha;
let findDuplicatesScriptSha;

const fileMetadataSchema = new Schema(
	"ino",
	{
		ino: { type: "string", searchable: true },
		path: { type: "string[]", searchable: true },
		shares: { type: "string[]", searchable: true },
		size: { type: "number", searchable: true },
		nlink: { type: "number" },
		atime: { type: "date" },
		mtime: { type: "date" },
		ctime: { type: "date" },
		hash: { type: "string", searchable: true },
		action: { type: "string" },
	},
	{
		dataStructure: "HASH",
	}
);

const connection = {
  host: 'localhost',
  port: 6379
};

const fileProcessingQueue = new Queue('file-processing', { connection });
const actionQueue = new Queue('action-queue', { connection });

async function connectToRedis() {
	if (!redisClient) {
		// Create and connect the node-redis client
		redisClient = createClient({ url: "redis://localhost:6379" });
		redisPublisherClient = createClient({ url: "redis://localhost:6379" });
		redisSubscriberClient = createClient({ url: "redis://localhost:6379" });


		await Promise.all([
			redisClient.connect(),
			redisPublisherClient.connect(),
			redisSubscriberClient.connect(),
		]);

		// --- Configure Keyspace Notifications ---
		await redisClient.configSet('notify-keyspace-events', 'AKE');
		console.log("[REDIS] Configured keyspace notifications ('AKE').");


		// Use the connected client to initialize redis-om
		omClient = new Client();
		await omClient.use(redisClient);

		fileMetadataRepository = omClient.fetchRepository(fileMetadataSchema);
		try {
			await fileMetadataRepository.createIndex();
			console.log("[REDIS] Search index created successfully.");
		} catch (e) {
			console.error("[REDIS] FATAL: Failed to create search index.");
			console.error("[REDIS] This is often caused by the RediSearch module not being loaded on the Redis server.");
			console.error("[REDIS] Please ensure your Redis instance has the RediSearch module enabled (e.g., by using the 'redis/redis-stack-server' Docker image).");
			console.error("[REDIS] Original error:", e);
			process.exit(1);
		}

		const luaDir = path.join(__dirname, "lua");
		const findWithMultiplePathsLua = await fs.readFile(path.join(luaDir, "findWithMultiplePaths.lua"), "utf8");
		const findWithNonUniqueHashesLua = await fs.readFile(path.join(luaDir, "findWithNonUniqueHashes.lua"), "utf8");
		const findDuplicatesLua = await fs.readFile(path.join(luaDir, "find-duplicates.lua"), "utf8");

		findWithMultiplePathsScriptSha = await redisClient.scriptLoad(findWithMultiplePathsLua);
		findWithNonUniqueHashesScriptSha = await redisClient.scriptLoad(findWithNonUniqueHashesLua);
		findDuplicatesScriptSha = await redisClient.scriptLoad(findDuplicatesLua);

		redisFunctions.init({
			getRedisClient,
			getFileMetadataRepository,
			findWithMultiplePathsScriptSha,
			findWithNonUniqueHashesScriptSha,
			findDuplicatesScriptSha,
		});
	}
	return { redisClient, fileMetadataRepository };
}

function getFileMetadataRepository() {
	if (!fileMetadataRepository) {
		throw new Error("Redis repository not initialized. Call connectToRedis() first.");
	}
	return fileMetadataRepository;
}

function getRedisClient() {
	if (!redisClient) {
		throw new Error("Redis client not initialized. Call connectToRedis() first.");
	}
	return redisClient;
}

function getRedisPublisherClient() {
	if (!redisPublisherClient) {
		throw new Error("Redis publisher client not initialized. Call connectToRedis() first.");
	}
	return redisPublisherClient;
}

async function closeRedis() {
	if (redisClient) {
		await redisClient.quit();
		redisClient = null;
		omClient = null;
		fileMetadataRepository = null;
	}
	if (redisPublisherClient) {
		await redisPublisherClient.quit();
		redisPublisherClient = null;
	}
	// Also close the BullMQ queue connection
	if (fileProcessingQueue) {
		await fileProcessingQueue.close();
	}
	if (actionQueue) {
		await actionQueue.close();
	}
}

module.exports = {
    connectToRedis,
    startRedisSubscriber,
    getFileMetadataRepository,
    getRedisClient,
    getRedisPublisherClient,
    closeRedis,
    fileMetadataSchema,
    fileProcessingQueue,
    actionQueue,
    parseHGetAll: redisFunctions.parseHGetAll,
    findBySize: redisFunctions.findBySize,
    findByPath: redisFunctions.findByPath,
    findWithMultiplePaths: redisFunctions.findWithMultiplePaths,
    findWithNonUniqueHashes: redisFunctions.findWithNonUniqueHashes,
    getAllFiles: redisFunctions.getAllFiles,
    findDuplicates: redisFunctions.findDuplicates,
    getActionQueue: redisFunctions.getActionQueue,
};

async function startRedisSubscriber() {
  if (!redisSubscriberClient || !redisSubscriberClient.isOpen) {
    console.error('[REDIS_SUB] Subscriber client not connected.');
    return;
  }
  console.log('[REDIS_SUB] Starting Redis keyspace event listener...');

  await redisSubscriberClient.pSubscribe('__keyspace@0__:ino:*', async (message, channel) => {
    const key = channel.substring('__keyspace@0__:'.length);
    const ino = key.split(':')[1];

    if (message === 'hset' || message === 'hmset') {
      try {
        const fileEntity = await fileMetadataRepository.fetch(ino);
        if (fileEntity) {
          broadcaster.broadcast({
            action: 'addOrUpdateFile',
            data: fileEntity.toJSON(),
          });
        }
      } catch (error) {
        console.error(`[REDIS_SUB] Error fetching entity for ${key} after '${message}' event:`, error);
      }
    } else if (message === 'del') {
      broadcaster.broadcast({
        action: 'removeFile',
        data: { ino },
      });
    }
  });
}
