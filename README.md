# poe2-mcp

An MCP server that wraps [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) as a callable compute layer for Path of Exile 2 builds. Load a PoB build code and get DPS, EHP, resistances, and tree info; mutate the passive tree and gem setup; or run async genetic-algorithm searches that optimize the tree or the support-gem layout toward an objective. A browser companion renders the tree, lets you tweak the main skill / minion skill / supports interactively, and animates searches live.

It is **not** a game client and makes **no** GGG API calls. It drives PoB2's headless calc engine in a LuaJIT subprocess.

## Prerequisites

- **Node.js 22+**
- **LuaJIT**
  - macOS: `brew install luajit`
  - Windows: `winget install DEVCOM.LuaJIT`
  - Linux: `sudo apt install luajit` (or `sudo pacman -S luajit`)
- **Git**

## Setup

```sh
git clone <this-repo>
cd poe2-mcp
npm install
npm run setup        # clones PathOfBuilding-PoE2 into pob2/ and verifies deps
npm run build:web    # optional: build the live tree-viz UI (see below)
```

`pob2/` is git-ignored and managed by the setup script. Don't edit it by hand. Re-run `npm run setup` (or the `update_pob2` tool) to refresh it.

## Run

```sh
npm run dev     # development: tsx watch, port 3000
# or
npm run build && npm start   # production
```

The server listens on `http://localhost:3000/mcp` (MCP endpoint) and serves the viz at `http://localhost:3000` (live in `npm run dev`, or from the built bundle after `npm run build:web`).

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

1. **Load a build.** Export your build from PathOfBuilding (Import/Export → Copy) and pass it via `load_build({ pob_code })` or `load_build({ pob_code_path })`. Required before any other tool. If the export is from poe.ninja (which omits the Companion-gem `skillId` and `<BeastCompanion>` library entries), `load_build` auto-repairs the in-memory build and reports the count in `fixed_companions` on the response.
2. **Read the summary.** `get_build_summary` aggregates info, dps, ehp, breakpoints, tree, socket groups, allocated nodes, and per-Companion minion-skill info in one call. It internally calls `set_full_dps_inclusion({ all_enabled: true, included: true })` so secondary-skill damage (e.g. poison) shows up in `full_dps`. Use the per-area tools (`get_dps`, `get_ehp`, `get_breakpoints`, `get_tree_summary`, `get_socket_groups`) when you only need one.
3. **Pick a Companion's skill (optional).** For builds with a `Companion: <beast>` gem, the beast usually has multiple skills. `get_minion_skills` lists every Companion gem's available minion skills with indices; `set_minion_skill({ group, skill_index })` pins one. `compare_companions` ranks beasts (your beast library or every beast in PoB) under a given socket group's supports.
4. **Optimize the tree.** Async genetic-algorithm search:
   - `search_start({ objective: { stat: "FullDPS" }, start_mode: "current", generations: 20 })` returns a `job_id` immediately.
   - `search_status({ job_id })` polls progress (status, generation, champion score).
   - `search_result({ job_id })` returns the best build found (score, stats, allocated node ids, per-generation trajectory).
   - `search_cancel({ job_id })` stops early; the best-so-far is kept.
5. **Optimize support gems.** Same lifecycle, different objective surface:
   - `gem_search_start({ objective: { stat: "FullDPS" }, mode: { idealized: true }, scope: "main" })` returns a `job_id`.
   - `gem_search_status` / `gem_search_result` / `gem_search_cancel` mirror the tree-search shape.
   - For Companion main skills, pass `minion_skill_index: N` to pin the minion skill instead of iterating every one per support trial (much faster). Defaults to whichever skill the gem currently uses (set via `set_minion_skill` or the viz dropdown).

Both searches run server-side and survive client disconnect, so long runs don't hold an open connection.

> **DPS/EHP caveats:** PoB's numbers assume the build's configured conditions (charges, flasks, enemy state, monster modifiers on tamed beasts, etc). They are theoretical figures from PoB's config, not guaranteed in-game values. A pure-`FullDPS` search will trade away defenses for damage; constrain it (e.g. `constraints: { min: { TotalEHP: 20000 } }`) or use a weighted objective (`{ weights: { FullDPS: 1.0, TotalEHP: 30 } }`) to keep survivability.

## Tools

**Build & stats**

| Tool                     | What it does                                                               |
| ------------------------ | -------------------------------------------------------------------------- |
| `load_build`             | Load a PoB2 share code or XML. Auto-repairs poe.ninja Companion gems.      |
| `get_build_info`         | Header: class, ascendancy, level, main skill, weapon-set points.           |
| `get_build_summary`      | One call: info + dps + ehp + breakpoints + tree + socket groups + minions. |
| `get_dps`                | Full DPS, per-skill breakdown, DoT DPS, minion DPS.                        |
| `get_ehp`                | Life, ES, ward, armour, evasion, block, spell suppression.                 |
| `get_breakpoints`        | Crit chance/cap, hit chance, resistance caps.                              |
| `get_socket_groups`      | Skill gem groups, active skills, enabled / Full-DPS flags, is_main.        |
| `set_full_dps_inclusion` | Toggle which socket groups contribute to `full_dps`.                       |
| `set_main_socket_group`  | Set which socket group drives `main_skill` and `main_dps`.                 |
| `compare_gem_swap`       | Swap a gem, report the DPS delta, restore the original.                    |
| `export_build`           | Serialize the live build back to a PoB share code.                         |
| `revert_build`           | Restore the build to the pre-search baseline.                              |

**Companion / minion**

| Tool                 | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `get_minion_skills`  | List each Companion gem's available minion skills with indices.      |
| `set_minion_skill`   | Pin a Companion gem to a specific minion skill (e.g. "Pillar Slam"). |
| `compare_companions` | Rank beasts (library or all) under a socket group, per minion skill. |

**Passive tree**

| Tool                  | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `get_tree_summary`    | Points used, keystones, notables.                 |
| `get_allocated_nodes` | All allocated nodes with types and stats.         |
| `allocate_node`       | Allocate a node by id (auto-pathing).             |
| `deallocate_node`     | Deallocate a node by id.                          |
| `analyze_tree`        | Rank nearby unallocated nodes by power-per-point. |
| `reset_tree`          | Reset the passive tree.                           |

**Optimization (async)**

Tree-passive GA search:

| Tool            | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `search_start`  | Start a GA search; returns a `job_id` immediately.          |
| `search_status` | Poll a running search (status, generation, champion score). |
| `search_result` | Fetch the champion build + per-generation trajectory.       |
| `search_cancel` | Request cancellation; best-so-far is kept.                  |

Support-gem optimizer (greedy + GA polish):

| Tool                | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `gem_search`        | Synchronous one-shot: run greedy + polish, return the recommendation. |
| `gem_search_start`  | Async lifecycle: returns a `job_id` immediately.                      |
| `gem_search_status` | Poll a running gem search (group, phase, step, score).                |
| `gem_search_result` | Fetch the recommended supports + score delta.                         |
| `gem_search_cancel` | Request cancellation; current best is kept.                           |

**Maintenance**

| Tool          | What it does                                             |
| ------------- | -------------------------------------------------------- |
| `update_pob2` | Pull the latest PoB2 from GitHub and restart the engine. |

## Live tree-viz companion

A browser view of the loaded build, served at `http://localhost:3000`. Both observer and controller: it watches running searches over SSE and exposes a sidebar that lets you mutate the live build via the same MCP ops Claude would call.

**Observe.** Open or refresh mid-search and the page replays the snapshot (current job, trajectory, champion supports) then continues live. Two SSE channels stream from `/events`: `start` / `gen` / `end` for the tree GA, and `gem:snapshot` / `gem:start` / `gem:progress` / `gem:end` for the gem-support optimizer. The passive tree morphs each generation (newly-allocated nodes flash) and the gem panel shows phase/step/champion as it ticks.

**Control.** The sidebar surfaces:

- a **load panel** that loads a PoB code (paste or file path)
- the **summary** (class / ascendancy / level / main skill, offense, defense, resistances, per-group gems with per-gem DPS) where:
  - **clicking any non-main group title or active row** sets that group as the build's main
  - **each Companion gem** with multiple minion skills shows a dropdown to pick one (e.g. Basic Attack vs Pillar Slam) — the choice is what `gem_search` will optimize for
- **gem-search controls** (objective, scope, mode, start/cancel) with an elapsed-time counter that ticks immediately on start, so you see motion even before the first progress event
- under the recommendation diff: **Apply** (commits, clears the revert baseline) and **Revert** (restores the build to whatever it was when the search started)
- **export PoB code** (copy to clipboard) and **revert search** (restores the tree-GA baseline) under build actions

The viz is keyed to the active build identity, so in-place mutations (set-main, set-minion-skill, apply, revert) refresh stats without re-fetching the whole page or flashing empty.

**Developing the UI:** the frontend lives in `src/web/` (Vite + React, same package as the server). `npm run dev` serves both the MCP server and the viz (Vite middleware mode + HMR) on `:3000`.

## Project layout

```
src/                  TypeScript MCP server (Express HTTP/SSE)
  lua-bridge.ts         LuaJIT subprocess manager (stdin/stdout JSON)
  search-jobs.ts        async GA job registry + event bus (tree)
  gem-search-jobs.ts    async gem-search job registry + event bus
  active-build.ts       active-build + revert baseline state
  ops/                  shared op bodies (mcp tool + http route)
  tools/                one file per MCP tool
  web/                  Vite + React tree-viz companion (browser)
lua/
  pob-shim.lua          boots HeadlessWrapper, dispatches commands
  search.lua            tree-GA engine
  gem-search.lua        gem-support optimizer
pob2/                 PathOfBuilding-PoE2 clone (git-ignored, managed by setup)
tests/                vitest unit tests (mocked LuaBridge)
  integration/        spawns a real LuaJIT subprocess (skips if luajit/pob2 missing)
  test-build-minions*  PoB share codes used as fixtures
scripts/              smoke/integration runners (real LuaJIT)
```

## Dev commands

```sh
npm run dev          # server + viz (HMR), tsx watch
npm test             # all vitest suites (server + web, in one run)
npm run build        # tsc -> dist/
npm run build:web    # build the viz UI -> src/web/dist
npm run lint         # eslint
npm run format       # prettier --write
npm run typecheck    # tsc --noEmit (server + web projects)

npx tsx scripts/search-job-smoke.ts   # GA integration smoke (real LuaJIT)
npx tsx scripts/viz-smoke.ts          # SSE + search integration smoke
```

## Environment variables

| Var           | Default | Description                                         |
| ------------- | ------- | --------------------------------------------------- |
| `PORT`        | `3000`  | HTTP port.                                          |
| `POB2_BRANCH` | `dev`   | PoB2 branch to clone. Use `master` for last stable. |

## Platform support

Cross-platform. LuaJIT must be on `PATH` (as `luajit.exe` on Windows, `luajit` elsewhere). On Windows, the git hooks run via Git Bash (bundled with Git for Windows). File an issue if you hit platform-specific problems.

## Notes

- `pob2/` is a clone of [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2); its own license applies to that directory. This project bundles no GGG assets and makes no GGG API calls.
- PoB2 field names can shift after major game patches. If a stat returns `0` unexpectedly, re-verify after `update_pob2`.
- Per-tame monster modifiers (Haste Aura, Extra Crits, etc.) aren't modeled by PoB-PoE2 yet, so `compare_companions` and `gem_search` measure beasts as if all four mod slots were empty. The headline numbers can understate a heavily-modded companion build.
