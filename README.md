# adb-plugin-template

Clean starting point for building an external (npm-installable) plugin for
[Advanced Discord Bot](https://github.com/AdvancedDiscordBot/Advanced-Discord-Bot) (ADB).

See `adb-plugin-reminders` (sibling repo) for a complete, working example built from this template.

## Use this template

1. Copy this folder / use as a GitHub template repo, rename it to `adb-plugin-<your-name>`.
2. Find-and-replace `adb-plugin-template` with your real package name in `plugin.json`, `package.json`, source, and tests.
3. **Naming rule**: the package name (and the folder name, if run as a local plugin) must start with `adb-plugin-` — that's the exact string `PluginManager` scans `node_modules/` for.
4. Implement your feature in `index.js` / `commands/` / `models/`.
5. Update this README.

## Isolation (read this first)

This template stays isolated by default and uses APIs common to both supported
load modes. Worker isolation means plugin resource operations go through Core's
capability-gated RPC; it is not a reason to claim that all npm libraries fail to
resolve or that a Node worker alone is a complete security sandbox.

- **Worker:** `ctx.client` and the command handler's `client` argument are `null`.
  `ctx.discord` provides Discord operations through RPC. Returned Discord data and
  event arguments are serialized values, not discord.js class instances.
- **Direct:** the client is available, but `ctx.discord` does not exist. Background
  message delivery or scheduling needs a deliberate narrow mode adapter, as in
  `adb-plugin-reminders/lib/runtime.js`. Do not declare `raw-client` just to hide an
  incompatible scheduler signature or unsupported model operation.
- **Schemas are real `mongoose.Schema` instances.** `models/example.js` requires
  Mongoose to construct a schema without opening a connection. `ctx.defineModel`
  registers a namespaced model; workers serialize supported scalar fields, defaults,
  validation options, and indexes for Core to compile. Do not pass a raw definition
  or compiled model, and do not assume arbitrary custom schema functions survive RPC.
- **Use plain message/embed objects and shared model operations.** In particular,
  `updateOne` works in both modes; static `Model.save` is a worker facade, not a
  Mongoose model method. Current workers also attach `save`/`markModified` facades
  to non-lean documents, but those documents are not Mongoose instances.
- **Declare capabilities and handle errors.** Resource RPC calls reject when a
  required capability is missing. Await registration and operations rather than
  discarding their failures. Do not import bot internals, connect to Mongo yourself,
  or read secrets from the process environment.

Treat `ctx` as read-only except for its predeclared `models` field. Direct
`PluginContext` seals that shape and makes other fields non-writable; the current
worker shim does not enforce the same object immutability. Neither fact permits
mutating the runtime context as a plugin integration technique.

## Plugin contract

Every plugin's entry file (default `index.js`) must export:

```js
async function load(ctx) { /* ... */ }
module.exports = { load };
```

`PluginManager` calls `load(ctx)` once at startup (or on hot-reload). Errors thrown here disable just this plugin — they don't crash the bot.

Commands have the shape `{ data, execute(interaction, client) }`. A factory captures
the model and `ctx.db` from `load`; the second execute argument is never `ctx`.
This example implements `/example [text]`: it stores and echoes nonblank text up to
2000 characters with mentions disabled. Without text it reads the current guild's
`config.data.welcomeMessage`, falling back to the documented greeting. DMs are
rejected before storage. The member-join handler only logs for enabled guilds.

## `ctx` API reference

| Member | What it is |
|---|---|
| `ctx.client` | Direct client only; `null` in workers. Not used by this example. |
| `ctx.discord` | Worker only: `sendToChannel(channelId, payload)`, `sendDM(userId, payload)`, `getGuild(guildId)`, `getMember(guildId, userId)`, `fetchChannel(channelId)`. Never assume it exists in direct mode. |
| `ctx.db` | Shared config API: `getPluginConfig(guildId, name)`, `updatePluginConfig(guildId, name, data)`, `getAllPluginConfigs(guildId)`. Worker access needs `storage:own-collection`; Core scopes own-config access to the calling plugin. |
| `ctx.registerCommand(command)` | Register `{ data, execute(interaction, client) }`. Await it; registration is asynchronous in workers. |
| `ctx.registerEvent(eventName, handler, options?)` | Listen to a Discord event. Direct mode supplies native event arguments; Core forwards serialized arguments to workers, followed by a `null` client. Validate payload shape and handle async failures. |
| `ctx.defineModel(modelName, schema)` | Register a real Schema as `plugin_<your-plugin-name>_<modelName>`. Worker operations wait for schema registration. |
| `ctx.hooks.on(hookName, handler)` / `ctx.hooks.emitHook(hookName, payload)` | Subscribe/emit with `hooks:subscribe` / `hooks:emit`. `on` returns an unsubscribe function; worker hooks do not provide direct HookBus priority, `onAny`, or return-value merging. |
| `ctx.scheduler` (direct) | `schedule(name, expression, callback)` returns a cron task; remove by `unschedule(name)`. Names share a scheduler, so prefix them with your plugin name. |
| `ctx.scheduler` (worker) | `await schedule(expression, callback, name)` returns Core's task ID; `await cancel(taskId)` removes it. Requires `scheduler:cron`, which this template does not declare or use. |
| `ctx.config.env` | Worker environment grants supplied by Core (normally empty); direct mode receives the host config. Do not assume ambient secrets are available. |
| `ctx.logger` | `.info()` / `.warn()` / `.error()`, namespaced to your plugin |

`ctx.overrideCommand()` works only in direct mode; workers warn and do nothing.
Use `ctx.registerCommand()` for portable commands. `ctx.commands` is not a
registration API and is `null` in workers; there is no `ctx.events` namespace.

Shared model operations include `find().sort().skip().limit().lean()`, `findOne`,
`create`, `countDocuments`, `updateOne`, and `deleteOne`/`deleteMany`. `updateOne`
returns counts, not the updated document. Like Mongoose, it does not run schema
validators by default, so validate user-editable input in command handlers.

Plugin config rows have a top-level `enabled` flag and a `data` object. A missing
row is disabled. `updatePluginConfig(..., data)` replaces the entire `data` object,
not the enable flag. Read `config.enabled === true` before per-guild scheduled
side effects, including DMs: command/event routing does not automatically gate
an independent cron callback. Settings declarations alone do not implement
behavior: this example consumes `welcomeMessage`; other sample settings need
handlers before they can enforce limits, select modes, or send announcements.

## `plugin.json` fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | must start with `adb-plugin-` |
| `version` | yes | semver |
| `description` / `author` | yes | |
| `main` | no | defaults to `index.js` |
| `displayName` | no | shown in marketplace UI |
| `requiresRestart` | no | `true` disables hot-reload eligibility |
| `isolation` | no | `true` (default) run in a worker |
| `manifestVersion` | v2 | set to `2` |
| `process` | v2 | `{ model: "pooled"\|"persistent"\|"oneshot", maxExecutionMs, memoryMb, persistentReason }` |
| `capabilities` | **yes for isolated** | what the broker lets you do — `{ storage: [...], discord: [...], hooks: [...], scheduler: [...] }` |
| `permissions` | v2 | mirror of capabilities + `network.outbound` host allowlist, `filesystem`, `childProcess`, `nativeAddons` |
| `configSchema` | no | JSON Schema → per-guild settings UI, read via `ctx.db.getPluginConfig(guildId, name)` |
| `discordPermissions` | no | Discord permission flags for the bot invite link |

## Local testing (no bot, no Mongo required)

```bash
npm install
npm test
```

`test/local-harness.js` loads the plugin in both mock modes and calls the registered
handler with `execute(interaction, client)`, using the direct client or worker
`null`, never the plugin context. `createInteraction` supplies nested option data
and the matching getters. Reply validation enforces content (2000), description
(4096), and total embed text (6000) limits.

`test/mock-ctx.js` is a standalone contract double for the APIs exercised here,
not a complete Discord/Mongoose implementation. It uses real Mongoose casting,
defaults, validation, and ObjectIds over in-memory rows; implements query ordering,
pagination, date predicates, and scoped updates; distinguishes direct/worker
document and scheduler shapes; and checks declared worker capabilities. Config
updates preserve the enable flag and replace only `data`. Tests never connect to
Mongo, Discord, or another live service and never expose the runner's environment.

`runTask` invokes a registered callback, not Core's cron event transport. These
tests also do not execute Core's RPC interaction bridge or schema serializer.
Core must forward replies/options and route scheduler events by the returned
task ID correctly. Extend tests when using additional APIs, and verify the real
worker/broker path separately before deployment. Copy the mock into new plugin
repos; do not introduce runtime or test imports into sibling repositories.

## Testing inside a real bot

1. Have a working local checkout of Advanced Discord Bot.
2. Symlink or copy your plugin folder into its `plugins/` directory:
   ```bash
   ln -s $(pwd) /path/to/Advanced-Discord-Bot/plugins/adb-plugin-yourname
   ```
   or, to test the actual `node_modules/adb-plugin-*` discovery path a real npm install would use:
   ```bash
   npm link
   cd /path/to/Advanced-Discord-Bot && npm link adb-plugin-yourname
   ```
3. Start the bot, confirm your plugin's load-log line appears.
4. If you added slash commands, run `npm run deploy` in the bot repo — command *logic* hot-reloads, but Discord command *registration* needs an explicit deploy.
5. Exercise the feature for real in a Discord server.

## Publishing to npm

```bash
npm login
npm publish
```

Anyone installs it with `npm install adb-plugin-yourname` into their bot's root — ADB's `PluginManager` auto-discovers any `node_modules/adb-plugin-*` folder containing a `plugin.json`.

## Listing on the ADB plugin registry (optional)

See `REGISTRY-SETUP.md` in the main ADB repo — fork the registry repo, add an entry to `plugins.json` with your `npmPackage` name, open a PR.

## License

This project is licensed under the **GNU Affero General Public License v3.0**. See the [LICENSE](LICENSE) file for details.

This repository follows the policies of the main ADB project.

- **Contribution Guidelines**: [CONTRIBUTING.md](https://github.com/AdvancedDiscordBot/Advanced-Discord-Bot/blob/main/CONTRIBUTING.md)
- **Code of Conduct**: [CODE_OF_CONDUCT.md](https://github.com/AdvancedDiscordBot/Advanced-Discord-Bot/blob/main/CODE_OF_CONDUCT.md)
- **Security Policy**: [SECURITY.md](https://github.com/AdvancedDiscordBot/Advanced-Discord-Bot/blob/main/SECURITY.md)
