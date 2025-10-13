const { Schema } = require("redis-om");

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

module.exports = { fileMetadataSchema };