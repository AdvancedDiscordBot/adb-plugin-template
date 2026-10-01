# ADB Plugin Template

The official starting point for building ADB plugins. Clone this, fill in your details, and implement your logic.

## Getting Started

1. Copy this template folder and rename it `adb-plugin-yourname`
2. Replace `adb-plugin-template` in the manifest, package, source, and tests with your plugin name; fill in your metadata
3. Implement your logic inside `index.js` — export a `load(ctx)` function
4. Add configurable options to `configSchema` if needed
5. Add `Brochure.md` — describe your plugin for the dashboard

## Project Structure

```
adb-plugin-yourname/
├── plugin.json     # Manifest: name, version, permissions, config schema
├── index.js        # Entry point: exports load(ctx)
├── package.json    # npm metadata
└── Brochure.md     # Plugin description shown in the dashboard
```

## Plugin Context API

Your `load(ctx)` function receives a `PluginContext` with:

| API | Description |
|-----|-------------|
| `ctx.registerCommand(command)` | Register `{ data, execute(interaction, client) }`; await worker registration |
| `ctx.registerEvent(name, handler)` | Listen to Discord gateway events; workers receive serialized arguments |
| `ctx.defineModel(name, schema)` | Register a namespaced model from a real Mongoose Schema |
| `ctx.db.getPluginConfig(guildId, name)` | Read plugin settings under `data` and the top-level `enabled` flag |
| `ctx.scheduler` | Mode-specific cron API; requires a declared scheduler capability (not used by this template) |
| `ctx.logger` | Namespaced logger |

The example stores and echoes `/example [text]`, uses `welcomeMessage` when text
is omitted, validates message length, and disables mentions. Commands capture
dependencies from `load(ctx)`; their second argument is the client, not `ctx`.
The template works in direct and worker modes without a raw-client declaration.
See the README for exact runtime differences and offline regression tests.

## Publishing

When ready, publish to npm as `adb-plugin-yourname` and submit to the ADB plugin registry for marketplace listing.

> Package names must start with `adb-plugin-` to be discovered by the bot.
