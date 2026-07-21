// Run with: npm test  (or) node test/local-harness.js
//
// Loads the plugin against a bot-faithful mock ctx (test/mock-ctx.js), then
// exercises each registered command with a fake interaction. This is the
// STARTING POINT — copy the pattern and add assertions for your own commands,
// events, and models. No running bot or MongoDB required.

const assert = require("node:assert");
const { load } = require("../index.js");
const { createMockCtx } = require("./mock-ctx");

// Minimal fake interaction. Add the option getters / fields your command reads.
function fakeInteraction(options = {}) {
	const replies = [];
	return {
		guildId: options._guildId ?? "test-guild",
		user: options._user ?? { id: "test-user" },
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
	// createMockCtx returns the frozen `ctx` (what the bot hands your plugin)
	// plus test-only handles: registeredCommands, registeredEvents, emitEvent,
	// models, pluginConfigs, hooks. See test/mock-ctx.js.
	const { ctx, registeredCommands, registeredEvents, emitEvent } = createMockCtx({
		pluginName: "adb-plugin-template",
	});

	await load(ctx);

	assert.ok(registeredCommands.has("example"), "expected /example to be registered");

	const interaction = fakeInteraction({ text: "hi from test" });
	await registeredCommands.get("example").execute(interaction);

	assert.strictEqual(interaction.replies[0], "hi from test");

	// Isolation-safe event handler: feed a SERIALIZED payload (plain object, the
	// shape Core sends a worker) and confirm the handler reads it without error.
	assert.ok(registeredEvents.has("guildMemberAdd"), "expected guildMemberAdd handler");
	await emitEvent("guildMemberAdd", {
		id: "user-1",
		user: { id: "user-1", tag: "User#0001", username: "User" },
		guildId: "test-guild",
	});

	console.log("OK: all local-harness checks passed");
}

main().catch((error) => {
	console.error("Local harness failed:", error);
	process.exit(1);
});
