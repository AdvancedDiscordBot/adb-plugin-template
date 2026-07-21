# adb-plugin-template

Clean starting point for building an external (npm-installable) plugin for
[Advanced Discord Bot](https://github.com/AdvancedDiscordBot/Advanced-Discord-Bot) (ADB).

See `adb-plugin-reminders` (sibling repo) for a complete, working example built from this template.

## Use this template

1. Copy this folder / use as a GitHub template repo, rename it to `adb-plugin-<your-name>`.
2. Find-and-replace `adb-plugin-template` with your real package name in `plugin.json` and `package.json`.
3. **Naming rule**: the package name (and the folder name, if run as a local plugin) must start with `adb-plugin-` — that's the exact string `PluginManager` scans `node_modules/` for.
4. Implement your feature in `index.js` / `commands/` / `models/`.
5. Update this README.

## Isolation (read this first)

When the bot runs with plugin isolation enabled (the default), an npm-installed
plugin runs in a **sandboxed worker thread** — it cannot touch `process.env`,
`require('fs')`, the raw Discord client, or Mongo directly. It reaches those
only through capability-gated RPC on `ctx`. Keep your plugin isolation-safe:

- **Never use `ctx.client`** — it is `null` in a worker. Use `ctx.discord.*`.
- **Never `require("discord.js")` / `require("mongoose")` at runtime.** Model
  schemas are the exception: pass a plain schema object to `ctx.defineModel`,
  and Core compiles it.
- **Event payloads are serialized plain objects**, not discord.js instances.
  Read ids defensively: `eventPayload.guildId || eventPayload.guild?.id`.
- **Declare everything in `capabilities`.** The broker denies any RPC whose
  capability you didn't declare. Missing a capability = silent failure at
  runtime (the call throws "Missing capability: ...").

## Plugin contract

Every plugin's entry file (default `index.js`) must export:

```js
async function load(ctx) { /* ... */ }
module.exports = { load };
```

`PluginManager` calls `load(ctx)` once at startup (or on hot-reload). Errors thrown here disable just this plugin — they don't crash the bot.

## `ctx` API reference

| Member | What it is |
|---|---|
| `ctx.client` | `null` in isolated mode — **do not use**. Use `ctx.discord`. |
| `ctx.discord` | Isolation-safe Discord surface: `sendToChannel(channelId, {content, embeds, files})`, `sendDM(userId, payload)`, `getGuild(guildId)`, `getMember(guildId, userId)`, `fetchChannel(channelId)` |
| `ctx.db` | Capability-gated DB: `getPluginConfig(guildId, name)`, `updatePluginConfig(...)`, plus profile/server methods under `storage:read-profiles`/`write-profiles` |
| `ctx.registerCommand(command)` | Register a `{ data, execute }` slash command |
| `ctx.registerEvent(eventName, handler)` | Listen to a Discord event (handler gets a serialized payload in isolated mode) |
| `ctx.defineModel(modelName, schema)` | Compile a Mongo model namespaced as `plugin_<your-plugin-name>_<modelName>` |
| `ctx.hooks.on(hookName, handler)` / `ctx.hooks.emitHook(hookName, payload)` | Inter-plugin hook bus (needs `hooks:subscribe` / `hooks:emit`) |
| `ctx.scheduler.schedule(name, cron, fn)` / `ctx.scheduler.cancel(name)` | Recurring jobs (needs `scheduler:cron`) |
| `ctx.config.env` | Empty in isolated mode — secrets never leave Core |
| `ctx.logger` | `.info()` / `.warn()` / `.error()`, namespaced to your plugin |

`ctx.overrideCommand()` is **not available** in isolated mode — use `ctx.registerCommand()`.

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

`test/local-harness.js` loads your plugin against `test/mock-ctx.js` — a fake in-memory `ctx` — and exercises registered commands directly. Extend both files as you add features. This catches logic bugs fast; it does **not** replace a real smoke test (see below).

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
