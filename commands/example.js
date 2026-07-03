// Slash command module. Loaded and registered by index.js via ctx.registerCommand.
// Required shape: { data: SlashCommandBuilder-like object, execute(interaction, client) }

module.exports = {
	data: {
		name: "example",
		description: "Example command from the plugin template",
		options: [
			{
				name: "text",
				type: 3, // STRING
				description: "Text to echo back",
				required: false,
			},
		],
	},
	async execute(interaction) {
		const text = interaction.options.getString("text") || "Hello from the template plugin!";
		await interaction.reply(text);
	},
};
