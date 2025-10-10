const { Schema } = require("redis-om");

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
		// The prefix for the keys in Redis. Defaults to the class name.
		prefix: 'file',
		// The separator for the keys in Redis. Defaults to ':'.
		separator: ':',
	}
);

module.exports = { fileMetadataSchema };