const exampleCommand = require("./commands/example");
const exampleSchema = require("./models/example");

/**
 * Every ADB plugin exports a single `load(ctx)` function. `ctx` is frozen and
 * namespaced to this plugin.
 *
 * This template is ISOLATION-SAFE: it runs unchanged whether the bot loads it
 * directly (in-process) or in a sandboxed worker thread. The rules that keep
 * it isolation-safe:
 *
 *   1. Never touch `ctx.client` — it is `null` in a worker. Use `ctx.discord.*`.
 *   2. Never `require("discord.js")` / `require("mongoose")` at runtime — those
 *      modules don't resolve inside a worker. Model schemas are the exception:
 *      they're plain schema objects passed to `ctx.defineModel`, and the Core
 *      process compiles them.
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
	ctx.registerCommand(exampleCommand(ExampleModel));

	// --- Listen to a Discord event (isolation-safe) -------------------------
	// In isolated mode `eventPayload` is a plain serialized object, e.g.
	//   { id, user: { id, tag, username, avatarURL }, guildId, nickname, roles }
	// In direct mode it's the real GuildMember. Read ids from both shapes:
	ctx.registerEvent("guildMemberAdd", async (eventPayload) => {
		try {
			const guildId = eventPayload.guildId || eventPayload.guild?.id;
			const userId = eventPayload.user?.id || eventPayload.id;
			if (!guildId) return;

			// Read per-server settings (needs capability storage:own-collection).
			const config = await ctx.db.getPluginConfig(guildId, "adb-plugin-template");
			const message = config?.data?.welcomeMessage || "Hello from the template plugin!";

			ctx.logger.info(`template: member ${userId} joined ${guildId} — ${message}`);

			// To actually send a message you'd need a channel id in config, then:
			//   await ctx.discord.sendToChannel(channelId, { content: message });
		} catch (err) {
			ctx.logger.error("template guildMemberAdd handler failed:", err);
		}
	});

	// --- Hook into other plugins (needs capability hooks:subscribe) ----------
	// ctx.hooks.on("onLevelUp", async ({ userId, guildId, newLevel }) => {
	// 	ctx.logger.info(`template saw level-up: ${userId} -> ${newLevel}`);
	// });

	// --- Scheduled work (needs capability scheduler:cron) --------------------
	// await ctx.scheduler.schedule("cleanup", "0 * * * *", async () => {
	// 	ctx.logger.info("template hourly job");
	// });

	ctx.logger.info("Template plugin loaded");
}

module.exports = { load };
