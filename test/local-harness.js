// Run with: npm test  (or) node test/local-harness.js
// Loads the plugin against a mock ctx, then exercises each registered
// command with a fake interaction. Extend this per-plugin.

const assert = require("node:assert");
const { load } = require("../index.js");
const { createMockCtx } = require("./mock-ctx");

function fakeInteraction(options = {}) {
	const replies = [];
	return {
		options: {
			getString: (name) => options[name] ?? null,
			getInteger: (name) => options[name] ?? null,
			getUser: (name) => options[name] ?? null,
			getSubcommand: () => options._subcommand ?? null,
		},
		reply: async (payload) => {
			replies.push(payload);
			return payload;
		},
		replies,
	};
}

async function main() {
	const { ctx, commands } = createMockCtx({ pluginName: "adb-plugin-REPLACE_ME" });

	await load(ctx);

	assert.ok(commands.has("example"), "expected /example to be registered");

	const interaction = fakeInteraction({ text: "hi from test" });
	await commands.get("example").execute(interaction);

	assert.strictEqual(interaction.replies[0], "hi from test");

	console.log("OK: all local-harness checks passed");
}

main().catch((error) => {
	console.error("Local harness failed:", error);
	process.exit(1);
});
