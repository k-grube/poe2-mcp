# poe2-mcp

MCP server that wraps [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) as a callable compute layer. Load a PoB build code and get DPS, EHP, breakpoints, gem swap comparisons, and tree summaries.

## Prerequisites

- Node.js 22+
- LuaJIT
  - Mac: `brew install luajit`
  - Windows: `scoop install luajit`
  - Linux: `sudo apt install luajit`
- Git

## Setup

```sh
git clone <this-repo>
cd poe2-mcp
npm install
npm run setup   # clones PathOfBuilding-PoE2 into pob2/, verifies deps
```

## Run

```sh
npm run dev     # dev mode (tsx watch), port 3000
npm start       # production (requires npm run build first)
```

## Configure in Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "poe2-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Available tools

| Tool | What it does |
|---|---|
| `load_build` | Load a PoB2 XML export. Required before other tools. |
| `get_dps` | Full DPS, avg hit, DoT DPS, minion DPS |
| `get_ehp` | Life, ES, ward, armour, evasion, block, spell suppression |
| `get_breakpoints` | Crit cap, hit chance, resistance caps |
| `compare_gem_swap` | Swap a gem, compare DPS delta, restore original |
| `get_tree_summary` | Points used, keystones, notable passives |
| `update_pob2` | Pull latest PoB2 from GitHub + restart Lua subprocess |

## Environment variables

| Var | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `POB2_BRANCH` | `dev` | PoB2 branch. Use `master` for last stable release. |

## Windows

Tested on Mac. Windows support is best-effort — LuaJIT subprocess spawn and LUA_PATH handling work in theory but haven't been verified. File an issue if you hit problems.

## Prior art

For economy data, wiki search, and item prices, see the archived [sergeyklay/poe2-mcp-server](https://github.com/sergeyklay/poe2-mcp-server) (MIT) as a reference for those public APIs.
