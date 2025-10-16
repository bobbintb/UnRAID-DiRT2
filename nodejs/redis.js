const { Client, Schema } = require("redis-om");
const { createClient } = require("redis");
const { Queue } = require("bullmq");
const fs = require("fs").promises;
const path = require("path");
const redisFunctions = require("./redisFunctions");

let redisClient;
let omClient;
let fileMetadataRepository;
let findWithMultiplePathsScriptSha;
let findWithNonUniqueHashesScriptSha;

const fileMetadataSchema = new Schema(
	"ino",
	{
		path: { type: "string[]" },
		shares: { type: "string[]", searchable: true },
		size: { type: "number" },
		nlink: { type: "number" },
		atime: { type: "date" },
		mtime: { type: "date" },
		ctime: { type: "date" },
		hash: { type: "string" },
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

async function connectToRedis() {
	if (!redisClient) {
		// Create and connect the node-redis client
		redisClient = createClient({ url: "redis://localhost:6379" });
		await redisClient.connect();

		// Use the connected client to initialize redis-om
		omClient = new Client();
		await omClient.use(redisClient);

		fileMetadataRepository = omClient.fetchRepository(fileMetadataSchema);
		await fileMetadataRepository.createIndex();

		const luaDir = path.join(__dirname, "lua");
		const findWithMultiplePathsLua = await fs.readFile(path.join(luaDir, "findWithMultiplePaths.lua"), "utf8");
		const findWithNonUniqueHashesLua = await fs.readFile(path.join(luaDir, "findWithNonUniqueHashes.lua"), "utf8");

		findWithMultiplePathsScriptSha = await redisClient.scriptLoad(findWithMultiplePathsLua);
		findWithNonUniqueHashesScriptSha = await redisClient.scriptLoad(findWithNonUniqueHashesLua);

		redisFunctions.init({
			getRedisClient,
			getFileMetadataRepository,
			findWithMultiplePathsScriptSha,
			findWithNonUniqueHashesScriptSha,
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

async function closeRedis() {
	if (redisClient) {
		await redisClient.quit();
		redisClient = null;
		omClient = null;
		fileMetadataRepository = null;
	}
}

module.exports = {
    connectToRedis,
    getFileMetadataRepository,
    getRedisClient,
    closeRedis,
    fileMetadataSchema,
    fileProcessingQueue,
    parseHGetAll: redisFunctions.parseHGetAll,
    findBySize: redisFunctions.findBySize,
    findWithMultiplePaths: redisFunctions.findWithMultiplePaths,
    findWithNonUniqueHashes: redisFunctions.findWithNonUniqueHashes,
};
