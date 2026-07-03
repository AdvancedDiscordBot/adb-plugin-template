const exampleCommand = require("./commands/example");
const exampleSchema = require("./models/example");

/**
 * Every ADB plugin exports a single `load(ctx)` function. `ctx` is frozen
 * and namespaced to this plugin — see README.md for the full API reference.
 */
async function load(ctx) {
	// --- Register a slash command -----------------------------------------
	ctx.registerCommand(exampleCommand);

	// --- Define a namespaced DB model (optional) ----------------------------
	// Becomes collection `plugin_<your-plugin-name>_example` in Mongo.
	const ExampleModel = ctx.defineModel("example", exampleSchema);
	void ExampleModel; // use it inside commands/events as needed

	// --- Listen to a Discord event (optional) -------------------------------
	// ctx.registerEvent("guildMemberAdd", async (member, client) => {
	// 	ctx.logger.info(`${member.user.tag} joined ${member.guild.name}`);
	// });

	// --- Override an existing core/plugin command (optional) ----------------
	// ctx.overrideCommand("daily", (originalExecute, command) => {
	// 	return async (interaction) => {
	// 		ctx.logger.info("daily command intercepted");
	// 		return originalExecute(interaction);
	// 	};
	// });

	// --- Hook into bot lifecycle events (optional) --------------------------
	// ctx.hooks.on("onLevelUp", async ({ user, newLevel, guild }) => {
	// 	ctx.logger.info(`${user.tag} hit level ${newLevel}`);
	// });

	// --- Scheduled/cron work (optional) --------------------------------------
	// NOTE: ctx.scheduler is the bot's internal TaskScheduler instance and, as
	// of the current ADB core, does NOT expose a generic `.schedule(name, cron, fn)`
	// method despite what some docs imply. Bring your own `node-cron` dependency
	// for plugin-owned periodic jobs instead — see adb-plugin-reminders for a
	// working example.
	// const cron = require("node-cron");
	// cron.schedule("*/5 * * * *", async () => { ... });

	// --- Read env config (read-only) -----------------------------------------
	// const token = ctx.config.env.SOME_API_KEY;

	ctx.logger.info("Template plugin loaded");
}

module.exports = { load };
