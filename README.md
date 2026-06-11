# poe2-mcp

An MCP server that wraps [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) as a callable compute layer for Path of Exile 2 builds. Load a PoB code to read DPS, EHP, resistances, and tree info; mutate the passive tree and gems; or run genetic-algorithm searches that optimize the tree or support-gem layout toward an objective. A browser companion renders the tree and animates searches live.

Not a game client, and makes no GGG API calls. It drives PoB2's headless calc engine in a LuaJIT subprocess.

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
npm run build:web    # optional: build the tree-viz UI
```

`pob2/` is git-ignored and managed by the setup script. Don't edit it by hand; re-run `npm run setup` (or the `update_pob2` tool) to refresh it.

## Run

```sh
npm run dev     # development: tsx watch, port 3000
# or
npm run build && npm start   # production
```

MCP endpoint at `http://localhost:3000/mcp`; the viz at `http://localhost:3000`.

## Connect to Claude Code

With the server running:

```sh
claude mcp add --transport http poe2-mcp http://localhost:3000/mcp
```

Add `--scope user` to make it available in every project. Or add it to your MCP client config manually:

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

Driven by Claude through the MCP tools:

1. **Load a build.** Export from PathOfBuilding (Import/Export → Copy) and pass it via `load_build({ pob_code })` or `load_build({ pob_code_path })`. Required before any other tool. poe.ninja exports get their Companion gems auto-repaired (reported as `fixed_companions`).
2. **Read the summary.** `get_build_summary` aggregates info, dps, ehp, breakpoints, tree, socket groups, and per-Companion minion-skill info in one call. Use the per-area tools (`get_dps`, `get_ehp`, `get_breakpoints`, ...) when you only need one slice.
3. **Optimize the tree.** `search_start` returns a `job_id` immediately; poll `search_status`, then `search_result` for the champion build. `search_cancel` stops early and keeps the best-so-far.
4. **Optimize support gems.** Same lifecycle: `gem_search_start` / `gem_search_status` / `gem_search_result` / `gem_search_cancel`. For Companion skills, pass `minion_skill_index: N` to pin the minion skill instead of iterating every one per support trial (much faster).

Both searches run server-side and survive client disconnect, so long runs don't hold an open connection.

> **DPS/EHP caveats:** PoB's numbers assume the build's configured conditions (charges, flasks, enemy state, monster modifiers on tamed beasts, etc). They are theoretical figures from PoB's config, not guaranteed in-game values. A pure-`FullDPS` search trades defenses for damage; constrain it (e.g. `constraints: { min: { TotalEHP: 20000 } }`) or use a weighted objective (`{ weights: { FullDPS: 1.0, TotalEHP: 30 } }`) to keep survivability.

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
| `get_valid_supports`     | Every support PoB considers valid for a group's active skill.              |
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

`gem_search` and `gem_search_start` accept `max_supports: N` to cap the slot count per group (e.g. "best 2 supports for this skill").

**Maintenance**

| Tool          | What it does                                             |
| ------------- | -------------------------------------------------------- |
| `update_pob2` | Pull the latest PoB2 from GitHub and restart the engine. |

## Live tree-viz companion

A browser view of the loaded build at `http://localhost:3000`, both observer and controller.

**Observe.** Open or refresh mid-search and the page replays the snapshot, then continues live over SSE (`/events`): the tree GA (`start` / `gen` / `end`) and the gem optimizer (`gem:*`). The passive tree morphs each generation (newly-allocated nodes flash); the gem panel shows phase/step/champion as it ticks.

**Control.** The sidebar loads a PoB code (paste or file path), shows the build summary (click any non-main group to set it main; pick a Companion's minion skill from a dropdown), runs gem searches, and exposes Apply / Revert / export-code actions. Stats refresh in place on mutation without reloading the page.

The frontend lives in `src/web/` (Vite + React, same package as the server). `npm run dev` serves both the MCP server and the viz (Vite middleware + HMR) on `:3000`.

## Dev commands

```sh
npm run dev          # server + viz (HMR), tsx watch
npm test             # all vitest suites (server + web, in one run)
npm run build        # tsc -> dist/
npm run build:web    # build the viz UI -> src/web/dist
npm run lint         # eslint
npm run format       # prettier --write
npm run typecheck    # tsc --noEmit (server + web projects)
```

## Environment variables

| Var           | Default | Description                                         |
| ------------- | ------- | --------------------------------------------------- |
| `PORT`        | `3000`  | HTTP port.                                          |
| `POB2_BRANCH` | `dev`   | PoB2 branch to clone. Use `master` for last stable. |

## Notes

- `pob2/` is a clone of [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2); its own license applies to that directory. This project bundles no GGG assets and makes no GGG API calls.
- PoB2 field names can shift after major game patches. If a stat returns `0` unexpectedly, re-verify after `update_pob2`.
- Per-tame monster modifiers (Haste Aura, Extra Crits, etc.) aren't modeled by PoB-PoE2 yet, so `compare_companions` and `gem_search` measure beasts as if all four mod slots were empty. The headline numbers can understate a heavily-modded companion build.

```

```
