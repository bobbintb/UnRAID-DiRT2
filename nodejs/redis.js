const { Client, Schema } = require("redis-om");

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

async function connectToRedis() {
	if (!client) {
		client = new Client();
		await client.open("redis://localhost:6379");
		fileMetadataRepository = client.fetchRepository(fileMetadataSchema);
		await fileMetadataRepository.createIndex();
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

module.exports = {
    connectToRedis,
    getFileMetadataRepository,
    closeRedis,
    fileMetadataSchema
};