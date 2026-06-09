# poe2-mcp agent guide

MCP server wrapping PathOfBuilding-PoE2 for build evaluation. Not a game client, no GGG API calls.

## Architecture

TypeScript Express HTTP/SSE MCP server -> LuaJIT subprocess (`lua/pob-shim.lua`) -> HeadlessWrapper.lua -> `pob2/` (auto-cloned from PathOfBuildingCommunity/PathOfBuilding-PoE2 dev branch).

One long-lived LuaJIT process per server instance. Build state persists between tool calls. Call `load_build` before any stat tools.

## Key files

- `src/lua-bridge.ts`. Subprocess manager. stdin/stdout newline-delimited JSON. seq field for correlation. Non-JSON stdout lines are PoB startup chatter and get swallowed.
- `src/pob-manager.ts`. PoB2 clone/pull/verify, uses `pob2/` relative to project root.
- `src/tools/registry.ts`. Aggregates all tool definitions and handlers.
- `src/ops/`. Shared op bodies, called by both MCP tools and HTTP routes. Pattern: write op body once in `src/ops/<name>.ts`, register the MCP tool wrapper in `src/tools/<name>.ts`, mount the HTTP route in `src/index.ts`.
- `src/web/src/`. Vite + React viz. Hits the same HTTP routes the MCP tools wrap.
- `lua/pob-shim.lua`. Boots HeadlessWrapper, dispatches `handlers["<cmd>"]`, extracts stats from `build.calcsTab.mainOutput`.
- `lua/search.lua`, `lua/gem-search.lua`. Tree-GA engine and support-gem optimizer.
- `pob2/`. Gitignored, managed by pob-manager. Do not edit manually.

## Conventions

- No provenance or future-plans comments. Don't credit a source repo the code came from (that's git history), don't editorialize about planned features (that's a doc or PR body). Write reused code as if native here.

## Dev commands

```sh
npm run setup       # clone pob2 + verify deps
npm run dev         # server with tsx watch on port 3000 (also serves the viz)
npm test            # vitest, all suites (server + web)
npm run build       # tsc -> dist/
npm run typecheck   # tsc --noEmit for both server and web projects
```

## Adding a tool

1. Create `src/tools/<name>.ts` exporting `definition: Tool` and `handler(bridge, args): Promise<CallToolResult>` via `defineTool` + `bridgeCmd`.
2. Add a Lua handler in `lua/pob-shim.lua` under `handlers["<cmd>"]`.
3. Register in `src/tools/registry.ts`.
4. Add tests in `tests/tools/<name>.test.ts` (mock `bridge.send`).
5. If the viz needs the tool, factor the body into `src/ops/<name>.ts`, have the tool call it, and mount `app.post('/api/<route>', ...)` in `src/index.ts` calling the same op.

## Lua field names

PoB2 field names for `mainOutput` were verified during initial setup. If a field returns 0 unexpectedly, run `{"cmd":"probe_output"}` via the shim to dump all numeric keys. PoB2 field names can shift after major patches; re-verify after `update_pob2`.

## Companion gem gotchas

- PoB shares one mutable `grantedEffect.name` across every Companion gem in a build. Whichever Companion gem is processed last writes its name into that field, so reading `activeEffect.grantedEffect.name` for a different Companion gem returns the wrong beast. To resolve a Companion gem's true name, look up `gem.skillMinion -> build.data.minions[id].name` and format as `"Companion: " .. minion.name`. The shim does this in `get_socket_groups`, `get_build_info`, and (via `skill_part`) in `get_dps`. Any new code reading a Companion's display name should follow the same pattern.
- poe.ninja exports Companion gems with only `nameSpec` set (missing `skillId`, `skillMinion`, and `<BeastCompanion>` library entries). `load_build` auto-repairs these in place and reports the count as `fixed_companions: N` on the response. That's expected, not an error.

## PoB DPS caveats

`get_dps` assumes the build's PoB configuration: charges, flasks, enemy conditions, etc. Always note assumptions when reporting DPS to users. The "recommended supports" lists in PoB data are game defaults, NOT optimal combos. Per-tame monster modifiers (Haste Aura, Extra Crits, etc.) aren't modeled by PoB-PoE2 yet, so any companion-related DPS we report understates a heavily-modded build.
