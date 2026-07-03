// Minimal in-memory stand-in for the real PluginContext (core/PluginContext.js
// in the ADB repo). Enough to load a plugin and call its command execute()
// functions without a real Discord client or MongoDB connection.
//
// This is NOT the real API surface — it's a fake for local testing. Some
// things (mongoose models, real cron, hook priority ordering) are simplified
// or stubbed. Always do a final smoke test inside a real bot (see README).

function createMockCtx({ pluginName = "test-plugin" } = {}) {
	const commands = new Map();
	const events = [];
	const overrides = new Map();
	const models = new Map();
	const hookHandlers = new Map();

	const logger = {
		info: (...args) => console.log(`[${pluginName}]`, ...args),
		warn: (...args) => console.warn(`[${pluginName}]`, ...args),
		error: (...args) => console.error(`[${pluginName}]`, ...args),
	};

	const ctx = {
		client: { commands, guilds: { cache: new Map() } },
		db: null, // plug in your own fake DB object per-test if a plugin needs ctx.db
		scheduler: null, // real ADB core has no generic .schedule() — see index.js note
		commands,
		registerCommand(command) {
			if (!command?.data?.name || typeof command.execute !== "function") {
				throw new Error("Invalid command: needs data.name and execute()");
			}
			commands.set(command.data.name, command);
		},
		overrideCommand(name, overrideFn) {
			const command = commands.get(name);
			if (!command) throw new Error(`Command not found: ${name}`);
			const original = overrides.get(name) || command.execute;
			overrides.set(name, original);
			command.execute = overrideFn(original, command);
		},
		registerEvent(name, handler, options = {}) {
			events.push({ name, handler, options });
		},
		defineModel(modelName, schema) {
			// No real mongoose connection here — just track that it was called.
			models.set(`plugin_${pluginName}_${modelName}`, schema);
			return { modelName: `plugin_${pluginName}_${modelName}`, schema };
		},
		hooks: {
			on(hookName, handler) {
				if (!hookHandlers.has(hookName)) hookHandlers.set(hookName, []);
				hookHandlers.get(hookName).push(handler);
			},
			async emitHook(hookName, payload) {
				for (const handler of hookHandlers.get(hookName) || []) {
					await handler(payload);
				}
			},
		},
		config: { env: process.env },
		logger,
	};

	return { ctx, commands, events, models, hookHandlers };
}

module.exports = { createMockCtx };
