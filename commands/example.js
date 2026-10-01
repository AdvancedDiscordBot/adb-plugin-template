// Slash command module. index.js calls this factory with the plugin's model
// and passes the result to ctx.registerCommand.
//
// Required shape: { data, execute(interaction, client) }. Capture ctx dependencies
// in this factory; the handler's second argument is NOT ctx (and is null in workers).
//
// ISOLATION NOTE: `interaction` is a proxy in isolated mode — interaction.reply
// / editReply / followUp route back through the Core process. Option getters
// return plain values; Discord objects such as users are not rich class instances.
const { name: PLUGIN_NAME } = require("../plugin.json");

module.exports = (ExampleModel, db) => ({
	data: {
		name: "example",
		description: "Example command from the plugin template",
		dm_permission: false,
		options: [
			{
				name: "text",
				type: 3, // STRING
				description: "Text to store and echo back",
				required: false,
				min_length: 1,
				max_length: 2000,
			},
		],
	},
	async execute(interaction) {
		if (!interaction.guildId) return interaction.reply({ content: "Use this command in a server.", ephemeral: true });
		const config = await db.getPluginConfig(interaction.guildId, PLUGIN_NAME);
		const fallback = typeof config?.data?.welcomeMessage === "string"
			? config.data.welcomeMessage : "Hello from the template plugin!";
		const text = interaction.options.getString("text") ?? fallback;
		if (typeof text !== "string" || !text.trim()) {
			return interaction.reply({ content: "Text cannot be empty.", ephemeral: true });
		}
		if (text.length > 2000) {
			return interaction.reply({ content: "Text too long (max 2000 characters).", ephemeral: true });
		}

		// Persist through the namespaced model (routes via RPC when isolated).
		await ExampleModel.create({
			guildId: interaction.guildId,
			userId: interaction.user.id,
			data: text,
		});

		await interaction.reply({ content: text, allowedMentions: { parse: [] } });
	},
});
