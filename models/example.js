// Mongoose schema factory. index.js turns this into a namespaced model via
// ctx.defineModel("example", schema) -> collection "plugin_<pluginName>_example".
// Exporting a schema (not a compiled model) keeps this file free of a live
// mongoose connection, so it can be required in tests without a DB.

const { Schema } = require("mongoose");

module.exports = new Schema({
	guildId: { type: String, required: true, index: true },
	userId: { type: String, required: true },
	data: { type: String, default: "" },
	createdAt: { type: Date, default: Date.now },
});
