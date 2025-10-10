const { Client, Schema } = require("redis-om");
const fs = require("fs").promises;
const path = require("path");

const fileMetadataSchema = new Schema(
	"ino",
	{
		path: { type: "string[]" },
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

let client;
let fileMetadataRepository;
let findWithMultiplePathsScriptSha;
let findWithNonUniqueHashesScriptSha;

async function connectToRedis() {
	if (!client) {
		client = new Client();
		await client.open("redis://localhost:6379");
		fileMetadataRepository = client.fetchRepository(fileMetadataSchema);
		await fileMetadataRepository.createIndex();

		const luaDir = path.join(__dirname, "lua");
		const findWithMultiplePathsLua = await fs.readFile(path.join(luaDir, "findWithMultiplePaths.lua"), "utf8");
		const findWithNonUniqueHashesLua = await fs.readFile(path.join(luaDir, "findWithNonUniqueHashes.lua"), "utf8");

		findWithMultiplePathsScriptSha = await client.nodeRedis.scriptLoad(findWithMultiplePathsLua);
		findWithNonUniqueHashesScriptSha = await client.nodeRedis.scriptLoad(findWithNonUniqueHashesLua);
	}
	return { client, fileMetadataRepository };
}

function getFileMetadataRepository() {
	if (!fileMetadataRepository) {
		throw new Error("Redis repository not initialized. Call connectToRedis() first.");
	}
	return fileMetadataRepository;
}

async function closeRedis() {
	if (client) {
		await client.close();
		client = null;
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
	const prefix = repository.schema.prefix;
	const separator = repository.schema.separator;

	const results = await client.nodeRedis.evalSha(findWithMultiplePathsScriptSha, {
		arguments: [`${prefix}:*`, separator],
	});

	const entities = results.map(result => {
		const parsed = parseHGetAll(result);
		const entity = repository.createEntity(parsed);
        // Manually add the entityId that redis-om uses internally
		entity.entityId = parsed.entityId;
		return entity;
	});

	return entities;
}

async function findWithNonUniqueHashes() {
	const repository = getFileMetadataRepository();
	const prefix = repository.schema.prefix;

	const results = await client.nodeRedis.evalSha(findWithNonUniqueHashesScriptSha, {
		arguments: [`${prefix}:*`],
	});

	const entities = results.map(result => {
		const parsed = parseHGetAll(result);
		const entity = repository.createEntity(parsed);
		entity.entityId = parsed.entityId;
		return entity;
	});

	return entities;
}

module.exports = {
    connectToRedis,
    getFileMetadataRepository,
    closeRedis,
    fileMetadataSchema,
    findBySize,
    findWithMultiplePaths,
    findWithNonUniqueHashes,
};