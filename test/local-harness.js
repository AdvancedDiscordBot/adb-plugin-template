"use strict";

const assert = require("node:assert/strict");
const { load } = require("../index");
const schema = require("../models/example");
const manifest = require("../plugin.json");
const { createMockCtx, createInteraction, validatePayload } = require("./mock-ctx");

let passed = 0;
let failed = 0;
async function test(name, run) {
	try {
		await run();
		passed++;
		console.log(`PASS ${name}`);
	} catch (error) {
		failed++;
		console.error(`FAIL ${name}: ${error.stack}`);
	}
}

async function fixture(mode) {
	const mock = createMockCtx({ mode });
	await load(mock.ctx);
	return {
		...mock,
		model: mock.models.get(`plugin_${manifest.name}_example`),
		async execute(values = {}, actor) {
			const interaction = createInteraction(null, values, actor);
			await mock.registeredCommands.get("example").execute(interaction, mock.client);
			assert.equal(interaction.replies.length, 1);
			return interaction.replies[0];
		},
	};
}

async function main() {
	for (const mode of ["worker", "direct"]) {
		await test(`${mode}: example echoes and stores text through the registered execute(interaction, client)`, async () => {
			const f = await fixture(mode);
			const reply = await f.execute({ text: "hi from test" });
			assert.equal(reply.content, "hi from test");
			assert.deepEqual(reply.allowedMentions, { parse: [] });
			assert.equal(f.model._store[0].data, "hi from test");
			assert.equal(f.model._store[0].guildId, "guild-1");
			assert.equal(f.model._store[0].userId, "user-1");
		});

		await test(`${mode}: configured welcomeMessage is the no-text default and refreshes per invocation`, async () => {
			const f = await fixture(mode);
			assert.equal((await f.execute()).content, "Hello from the template plugin!");
			await f.ctx.db.updatePluginConfig("guild-1", manifest.name, { welcomeMessage: "configured" });
			assert.equal((await f.execute()).content, "configured");
			assert.equal((await f.execute({ text: "explicit" })).content, "explicit");
			assert.equal((await f.execute({}, { guildId: "guild-2" })).content, "Hello from the template plugin!");
		});

		await test(`${mode}: oversized/empty text is rejected before create, including oversized config`, async () => {
			const f = await fixture(mode);
			assert.match((await f.execute({ text: "x".repeat(2001) })).content, /2000|long/i);
			assert.match((await f.execute({ text: "   " })).content, /empty|required/i);
			await f.ctx.db.updatePluginConfig("guild-1", manifest.name, { welcomeMessage: "x".repeat(2001) });
			assert.match((await f.execute()).content, /2000|long/i);
			assert.equal(f.model._store.length, 0);
			assert.equal((await f.execute({ text: "x".repeat(2000) })).content.length, 2000);
		});

		await test(`${mode}: text cannot ping roles/everyone and DM commands fail gracefully`, async () => {
			const f = await fixture(mode);
			assert.deepEqual((await f.execute({ text: "@everyone <@&123456>" })).allowedMentions, { parse: [] });
			assert.match((await f.execute({ text: "x" }, { guildId: null })).content, /server/i);
			assert.equal(f.model._store.length, 1);
		});

		await test(`${mode}: member events handle direct and serialized shapes, ignore malformed/disabled events`, async () => {
			const f = await fixture(mode);
			f.pluginConfigs.set(`guild-1:${manifest.name}`, { guildId: "guild-1", pluginName: manifest.name, enabled: true, data: { welcomeMessage: "configured greeting" } });
			for (const member of [{ id: "u", guildId: "guild-1", user: { id: "u" } }, { id: "u", guild: { id: "guild-1" }, user: { id: "u" } }]) await f.emitEvent("guildMemberAdd", member);
			assert.equal(f.logs.filter((log) => log.args.join(" ").includes("configured greeting")).length, 2);
			const before = f.logs.length;
			for (const member of [null, {}, { guildId: "guild-1" }, { id: "u", guildId: "disabled" }]) await f.emitEvent("guildMemberAdd", member);
			assert.equal(f.logs.length, before);
		});

		await test(`${mode}: mock exposes the real runtime distinctions, casting, defaults, and query options`, async () => {
			const f = await fixture(mode);
			assert.equal("discord" in f.ctx, mode === "worker");
			assert.equal(f.client === null, mode === "worker");
			assert.equal(typeof f.model.save, mode === "worker" ? "function" : "undefined");
			const a = await f.model.create({ guildId: "guild-1", userId: "u", data: "first", createdAt: new Date(1000) });
			await f.model.create({ guildId: "guild-1", userId: "u", data: "second", createdAt: new Date(2000) });
			assert.equal(typeof a.save, "function");
			assert.equal(typeof a.markModified, "function");
			assert.equal(typeof a._id, mode === "worker" ? "string" : "object");
			a.data = "not saved";
			assert.equal((await f.model.findOne({ _id: String(a._id) })).data, "first");
			assert.equal((await f.model.find({ createdAt: { $lte: new Date(2000) } }).sort({ createdAt: -1 }).skip(1).limit(1).lean())[0].data, "first");
			assert.equal(typeof (await f.model.findOne({ _id: String(a._id) }).lean()).save, "undefined");
			await a.save();
			assert.equal((await f.model.findOne({ _id: String(a._id) })).data, "not saved");
			await assert.rejects(f.model.findOne({ _id: "not-an-objectid" }), /Cast to ObjectId/);
			const defaults = await f.model.create({ guildId: "guild-1", userId: "u" });
			assert.equal(defaults.data, "");
			assert.ok(defaults.createdAt instanceof Date);
			await assert.rejects(f.model.create({ userId: "u" }), /guildId/);
			await f.ctx.db.updatePluginConfig("guild-1", manifest.name, { old: 1 });
			const config = f.pluginConfigs.get(`guild-1:${manifest.name}`);
			assert.equal(config.enabled, false, "new configs are disabled by default");
			config.enabled = true;
			await f.ctx.db.updatePluginConfig("guild-1", manifest.name, { next: 2 });
			assert.deepEqual(await f.ctx.db.getPluginConfig("guild-1", manifest.name), { guildId: "guild-1", pluginName: manifest.name, enabled: true, data: { next: 2 } });
			if (mode === "direct") {
				assert.equal(Object.isExtensible(f.ctx), false);
				assert.throws(() => { f.ctx.extra = true; }, TypeError);
				f.ctx.models = { Example: f.model };
				assert.equal(f.ctx.models.Example, f.model);
			}
		});
	}

	await test("worker: absent storage capability is denied, not hidden by the mock", async () => {
		const mock = createMockCtx({ capabilities: {} });
		await load(mock.ctx);
		await assert.rejects(mock.registeredCommands.get("example").execute(createInteraction(null, { text: "x" }), mock.client), /storage:own-collection/);
	});
	await test("mock rejects oversize content, descriptions, and aggregate embeds independently", async () => {
		assert.throws(() => validatePayload({ content: "x".repeat(2001) }), /content limit/);
		assert.throws(() => validatePayload({ embeds: [{ description: "x".repeat(4097) }] }), /description limit/);
		assert.throws(() => validatePayload({ embeds: [{ description: "x".repeat(4000) }, { description: "x".repeat(2001) }] }), /aggregate/);
		assert.ok(schema.paths && schema.paths.createdAt, "a real Schema, not a raw schema definition");
	});
	console.log(`\n${passed} passed, ${failed} failed`);
	process.exitCode = failed ? 1 : 0;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
