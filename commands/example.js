// Slash command module. index.js calls this factory with the plugin's model
// and passes the result to ctx.registerCommand.
//
// Required shape: { data: SlashCommandBuilder-like object, execute(interaction) }
//
// ISOLATION NOTE: `interaction` is a proxy in isolated mode — interaction.reply
// / editReply / followUp route back through the Core process. Option getters
// (getString, getUser, ...) work the same as direct mode.

module.exports = (ExampleModel) => ({
	data: {
		name: "example",
		description: "Example command from the plugin template",
		options: [
			{
				name: "text",
				type: 3, // STRING
				description: "Text to store and echo back",
				required: false,
			},
		],
	},
	async execute(interaction) {
		const text =
			interaction.options.getString("text") ||
			"Hello from the template plugin!";

		// Persist through the namespaced model (routes via RPC when isolated).
		await ExampleModel.create({
			guildId: interaction.guildId,
			userId: interaction.user.id,
			data: text,
		});

		await interaction.reply(text);
	},
});
