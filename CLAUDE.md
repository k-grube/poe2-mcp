# poe2-mcp agent guide

MCP server wrapping PathOfBuilding-PoE2 for build evaluation. Not a game client — no GGG API calls.

## Architecture

TypeScript Express HTTP/SSE MCP server -> LuaJIT subprocess (`lua/pob-shim.lua`) -> HeadlessWrapper.lua -> `pob2/` (auto-cloned from PathOfBuildingCommunity/PathOfBuilding-PoE2 dev branch).

One long-lived LuaJIT process per server instance. Build state persists between tool calls — call `load_build` before any stat tools.

## Key files

- `src/lua-bridge.ts` — subprocess manager. stdin/stdout newline-delimited JSON. seq field for correlation.
- `src/pob-manager.ts` — PoB2 clone/pull/verify. uses `pob2/` relative to project root.
- `src/tools/registry.ts` — aggregates all tool definitions and handlers.
- `lua/pob-shim.lua` — Lua side: boots HeadlessWrapper, handles cmds, extracts stats from `build.calcsTab.mainOutput`.
- `pob2/` — gitignored, managed by pob-manager. do not edit manually.

## Conventions

- no provenance or future-plans comments. don't credit a source repo the code came from (that's git history), don't editorialize about planned features (that's a doc or PR body). write reused code as if native here.

## Dev commands

```sh
npm run setup   # clone pob2 + verify deps
npm run dev     # start server with tsx watch on port 3000
npm test        # vitest unit tests (mocked subprocess)
npm run build   # tsc -> dist/
```

## Adding a tool

1. Create `src/tools/<name>.ts` exporting `definition: Tool` and `handler(bridge, args): Promise<CallToolResult>`.
2. Add a Lua handler in `lua/pob-shim.lua` under `handlers["<cmd>"]`.
3. Register in `src/tools/registry.ts`.
4. Add tests in `tests/tools/<name>.test.ts` (mock `bridge.send`).

## Lua field names

PoB2 field names for `mainOutput` were verified during initial setup. If a field returns 0 unexpectedly, run `{"cmd":"probe_output"}` via the shim to dump all numeric keys. PoB2 field names can shift after major patches — re-verify after `update_pob2`.

## PoB DPS caveats

`get_dps` assumes build config as set in PoB — charges, flasks, enemy conditions all affect the number. Always note assumptions when reporting DPS to users. The "recommended supports" lists in PoB data are game defaults, NOT optimal combos.
