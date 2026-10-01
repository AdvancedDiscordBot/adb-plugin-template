const exampleCommand = require("./commands/example");
const exampleSchema = require("./models/example");

/**
 * Every ADB plugin exports `load(ctx)`. Treat ctx as read-only apart from models;
 * direct PluginContext enforces that restriction, the worker shim currently does not.
 *
 * This template is ISOLATION-SAFE: it runs unchanged whether the bot loads it
 * directly (in-process) or in a sandboxed worker thread. The rules that keep
 * it isolation-safe:
 *
 *   1. The command needs no raw client. ctx.discord exists ONLY in workers;
 *      non-command delivery needs an explicit mode adapter (see reminders).
 *   2. Export a real mongoose.Schema, not a model or raw definition. The worker
 *      serializes supported schema fields/indexes; Core compiles the model.
 *      Mongoose is still required locally to construct that schema, not to connect.
 *   3. Event handlers receive a *serialized* payload (plain object), not a
 *      Discord.js class instance. Read ids defensively (see below).
 *   4. Whatever your plugin does, it must be declared in plugin.json
 *      `capabilities` — the broker denies any RPC you didn't declare.
 */
async function load(ctx) {
	// --- Define a namespaced DB model (needs capability storage:own-collection)
	// Becomes collection `plugin_adb-plugin-template_example` in Mongo.
	const ExampleModel = ctx.defineModel("example", exampleSchema);

	// --- Register a slash command -----------------------------------------
	// Inject the model so the command file never has to reach outside the plugin.
	await ctx.registerCommand(exampleCommand(ExampleModel, ctx.db));

	// --- Listen to a Discord event (isolation-safe) -------------------------
	// In isolated mode `eventPayload` is a plain serialized object, e.g.
	//   { id, user: { id, tag, username, avatarURL }, guildId, nickname, roles }
	// In direct mode it's the real GuildMember. Read ids from both shapes:
	ctx.registerEvent("guildMemberAdd", async (eventPayload) => {
		try {
			const guildId = eventPayload?.guildId || eventPayload?.guild?.id;
			const userId = eventPayload?.user?.id || eventPayload?.id;
			if (!guildId || !userId) return;

			// Read per-server settings (needs capability storage:own-collection).
			const config = await ctx.db.getPluginConfig(guildId, "adb-plugin-template");
			if (config?.enabled !== true) return;
			const message = config?.data?.welcomeMessage || "Hello from the template plugin!";

			ctx.logger.info(`template: member ${userId} joined ${guildId} — ${message}`);

			// This example only logs. Sending requires a channel from config and a
			// direct/worker delivery adapter; ctx.discord is worker-only.
		} catch (err) {
			ctx.logger.error("template guildMemberAdd handler failed:", err);
		}
	});

	// --- Hook into other plugins (needs capability hooks:subscribe) ----------
	// ctx.hooks.on("onLevelUp", async ({ userId, guildId, newLevel }) => {
	// 	ctx.logger.info(`template saw level-up: ${userId} -> ${newLevel}`);
	// });

	// --- Scheduled work ----------------------------------------------------
	// Not declared by this template. Add scheduler:cron before scheduling jobs:
	// worker: schedule(expression, callback, name) -> taskId, cancel(taskId).
	// direct: schedule(name, expression, callback), unschedule(name).
	// See reminders/lib/runtime.js for the narrow compatibility adapter.

	ctx.logger.info("Template plugin loaded");
}

module.exports = { load };
