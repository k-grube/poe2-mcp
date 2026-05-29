# poe2-mcp

An MCP server that wraps [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) as a callable compute layer for Path of Exile 2 builds. Load a PoB build code and get DPS, EHP, resistances, and tree info; mutate the passive tree; or run a genetic-algorithm search that optimizes the tree toward an objective. An optional browser companion renders the tree and animates the search live.

It is **not** a game client and makes **no** GGG API calls — it drives PoB2's headless calc engine in a LuaJIT subprocess.

## Prerequisites

- **Node.js 22+**
- **LuaJIT**
  - macOS: `brew install luajit`
  - Windows: `scoop install luajit` (or the official LuaJIT build; must be on `PATH` as `luajit.exe`)
  - Linux: `sudo apt install luajit`
- **Git**

## Setup

```sh
git clone <this-repo>
cd poe2-mcp
npm install
npm run setup        # clones PathOfBuilding-PoE2 into pob2/ and verifies deps
npm run build:web    # optional: build the live tree-viz UI (see below)
```

`pob2/` is git-ignored and managed by the setup script — don't edit it by hand. Re-run `npm run setup` (or the `update_pob2` tool) to refresh it.

## Run

```sh
npm run dev     # development: tsx watch, port 3000
# or
npm run build && npm start   # production
```

The server listens on `http://localhost:3000/mcp` (MCP endpoint) and serves the viz at `http://localhost:3000/viz` if you ran `npm run build:web`.

## Connect to Claude Code

With the server running:

```sh
claude mcp add --transport http poe2-mcp http://localhost:3000/mcp
```

Add `--scope user` to make it available in every project (default is project-local). Verify with `claude mcp list` (it should report `✓ Connected`).

Or add it to your MCP client config manually:

```json
{
  "mcpServers": {
    "poe2-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Usage

A typical session, driven by Claude through the MCP tools:

1. **Load a build.** Export your build from PathOfBuilding (Import/Export → Copy) and:
   - `load_build` with `pob_code` (the share code inline), or `pob_code_path` (a file path — avoids pasting a large blob). Required before any other tool.
2. **Aggregate full DPS.** PoB defaults each skill's "include in Full DPS" to off. Call `set_full_dps_inclusion({ all_enabled: true, included: true })` so `get_dps.full_dps` sums every enabled skill (important for builds whose damage comes from a secondary/triggered skill, e.g. poison).
3. **Read stats.** `get_dps`, `get_ehp`, `get_breakpoints`, `get_tree_summary`.
4. **Optimize the tree (optional).** Start an async genetic-algorithm search, poll it, then fetch the champion:
   - `search_start({ objective: { stat: "FullDPS" }, start_mode: "current", generations: 20 })` → returns a `job_id` immediately.
   - `search_status({ job_id })` → poll for progress (status, generation, champion score).
   - `search_result({ job_id })` → the best build found (score, stats, allocated node ids, full per-generation trajectory).
   - `search_cancel({ job_id })` → stop early; the best-so-far is kept.

The search runs server-side and survives client disconnect, so long runs don't hold an open connection.

> **DPS/EHP caveats:** PoB's numbers assume the build's configured conditions — charges, flasks, enemy state, etc. They are theoretical figures from PoB's config, not guaranteed in-game values. A pure-`FullDPS` search will trade away defenses for damage; constrain it (e.g. `constraints: { min: { TotalEHP: 20000 } }`) or use a weighted objective (`{ weights: { FullDPS: 1.0, TotalEHP: 30 } }`) to keep survivability.

## Tools

**Build & stats**

| Tool                     | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `load_build`             | Load a PoB2 share code or XML. Required before other tools. |
| `set_full_dps_inclusion` | Toggle which socket groups contribute to `full_dps`.        |
| `get_dps`                | Full DPS, per-skill breakdown, DoT DPS, minion DPS.         |
| `get_ehp`                | Life, ES, ward, armour, evasion, block, spell suppression.  |
| `get_breakpoints`        | Crit chance/cap, hit chance, resistance caps.               |
| `get_socket_groups`      | Skill gem groups, active skills, enabled / Full-DPS flags.  |
| `compare_gem_swap`       | Swap a gem, report the DPS delta, restore the original.     |

**Passive tree**

| Tool                  | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `get_tree_summary`    | Points used, keystones, notables.                 |
| `get_allocated_nodes` | All allocated nodes with types and stats.         |
| `allocate_node`       | Allocate a node by id (auto-pathing).             |
| `deallocate_node`     | Deallocate a node by id.                          |
| `analyze_tree`        | Rank nearby unallocated nodes by power-per-point. |
| `reset_tree`          | Reset the passive tree.                           |

**Optimization (async genetic algorithm)**

| Tool            | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `search_start`  | Start a GA search; returns a `job_id` immediately.          |
| `search_status` | Poll a running search (status, generation, champion score). |
| `search_result` | Fetch the champion build + per-generation trajectory.       |
| `search_cancel` | Request cancellation; best-so-far is kept.                  |

**Maintenance**

| Tool          | What it does                                             |
| ------------- | -------------------------------------------------------- |
| `update_pob2` | Pull the latest PoB2 from GitHub and restart the engine. |

## Live tree-viz companion

A read-only browser view of the GA search, served at `http://localhost:3000/viz`.

- Build it once with `npm run build:web`, then start the server. The page renders the full passive tree; as Claude runs a search, the allocated set **morphs each generation** (newly-added nodes flash), a score chart climbs, and a stats panel shows champion-vs-initial deltas.
- It's an observer only — there are no controls. Claude/MCP drives the search; the browser just watches. Open or refresh it mid-search and it replays history then continues live.
- If the server has no build loaded, the page says so instead of rendering a blank tree.

**Developing the UI:** the frontend lives in `web/` as its own Vite + React project.

```sh
npm run dev        # terminal 1: the MCP server on :3000
npm run dev:web    # terminal 2: Vite dev server with HMR, proxies /api + /events to :3000
```

## Project layout

```
src/            TypeScript MCP server (Express HTTP/SSE)
  lua-bridge.ts   LuaJIT subprocess manager (stdin/stdout JSON)
  search-jobs.ts  async GA job registry + event bus
  tools/          one file per MCP tool
lua/pob-shim.lua  Lua side: boots HeadlessWrapper, extracts stats, runs the GA
web/            Vite + React tree-viz companion (own package.json)
pob2/           PathOfBuilding-PoE2 clone (git-ignored, managed by setup)
tests/          vitest unit tests (mocked subprocess)
scripts/        smoke/integration scripts
```

## Dev commands

```sh
npm run dev          # server, tsx watch
npm test             # server unit tests (vitest)
npm run build        # tsc -> dist/
npm run build:web    # build the viz UI -> web/dist
npm run lint         # eslint
npm run format       # prettier --write

cd web && npm test   # frontend unit tests
npx tsx scripts/search-job-smoke.ts   # GA integration smoke (real LuaJIT)
npx tsx scripts/viz-smoke.ts          # SSE + search integration smoke
```

## Environment variables

| Var           | Default | Description                                         |
| ------------- | ------- | --------------------------------------------------- |
| `PORT`        | `3000`  | HTTP port.                                          |
| `POB2_BRANCH` | `dev`   | PoB2 branch to clone. Use `master` for last stable. |

## Platform support

Developed and tested on macOS. The LuaJIT subprocess, path handling, and git hooks are written to be cross-platform; on Windows the hooks run via Git Bash (bundled with Git for Windows) and LuaJIT must be on `PATH` as `luajit.exe`. Windows is not extensively tested — please file an issue if you hit problems.

## Notes

- `pob2/` is a clone of [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2); its own license applies to that directory. This project bundles no GGG assets and makes no GGG API calls.
- PoB2 field names can shift after major game patches. If a stat returns `0` unexpectedly, re-verify after `update_pob2`.
