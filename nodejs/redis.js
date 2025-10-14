const { Client } = require("redis-om");
const { createClient } = require("redis");
const fs = require("fs").promises;
const path = require("path");
const { fileMetadataSchema } = require("./schema");

let redisClient;
let omClient;
let fileMetadataRepository;
let findWithMultiplePathsScriptSha;
let findWithNonUniqueHashesScriptSha;

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

function parseHGetAll(result) {
	const parsed = {};
	for (let i = 0; i < result.length; i += 2) {
		parsed[result[i]] = result[i + 1];
	}
	return parsed;
}

async function findBySize(size) {
	const repository = getFileMetadataRepository();
	return await repository.search().where("size").equals(size).return.all();
}

async function findWithMultiplePaths() {
	const repository = getFileMetadataRepository();
	const prefix = 'ino';

	const keys = await redisClient.evalSha(
		findWithMultiplePathsScriptSha,
		{
			keys: [],
			arguments: [`${prefix}:*`],
		},
	);

	return Promise.all(keys.map(key => repository.fetch(key.split(':').pop())));
}

async function findWithNonUniqueHashes() {
	const repository = getFileMetadataRepository();
	const prefix = 'ino';
	const separator = ':';


	const groupedKeys = await redisClient.evalSha(
		findWithNonUniqueHashesScriptSha,
		{
			keys: [],
			arguments: [`${prefix}${separator}*`],
		},
	);

	// The Lua script returns an array of arrays, where each inner array
	// is a group of keys for a set of duplicate files.
	return Promise.all(
		groupedKeys.map(keyGroup =>
			Promise.all(keyGroup.map(key => repository.fetch(key.split(':').pop())))
		)
	);
}

module.exports = {
    connectToRedis,
    getFileMetadataRepository,
    getRedisClient,
    closeRedis,
    fileMetadataSchema,
    findBySize,
    findWithMultiplePaths,
    findWithNonUniqueHashes,
};