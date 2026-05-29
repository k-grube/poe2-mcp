import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition: getAllocatedDef, handler: getAllocatedHandler } = defineTool(
  {
    name: 'get_allocated_nodes',
    description:
      "List every allocated node on the passive tree. Each entry: id, name, type (keystone/notable/normal/mastery/ascendancy/class_start/ascend_start/jewel_socket), ascendancy (if applicable), stats (array of stat description lines). Response also has points_used and ascendancy_points_used (PoB's actual counts, excluding class/ascend starts). Call load_build first.",
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_allocated_nodes'),
)

export const { definition: allocateDef, handler: allocateHandler } = defineTool(
  {
    name: 'allocate_node',
    description:
      'Allocate a passive tree node by id. PoB allocates the entire shortest path through unallocated nodes from your current allocation; path_added in the response = total nodes added (target + travel). Errors if id is not in the tree, already allocated, or no path exists. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'numeric node id (see get_allocated_nodes or analyze_tree for valid ids)' },
      },
      required: ['id'],
    },
  },
  bridgeCmd('allocate_node', z.object({ id: z.number().int().positive() })),
)

export const { definition: deallocateDef, handler: deallocateHandler } = defineTool(
  {
    name: 'deallocate_node',
    description:
      'Deallocate a passive tree node by id. PoB also removes any nodes that only reach the tree through this one (chain_removed = target + orphaned dependents). Errors if id is not currently allocated. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'numeric node id of an allocated node' },
      },
      required: ['id'],
    },
  },
  bridgeCmd('deallocate_node', z.object({ id: z.number().int().positive() })),
)

export const { definition: analyzeDef, handler: analyzeHandler } = defineTool(
  {
    name: 'analyze_tree',
    description:
      'Wraps PoB\'s built-in PowerBuilder: scores every unallocated tree node by its delta on a chosen output stat. Returns top_n candidates sorted by path_power (stat delta if you allocate the full shortest path to that node). Each entry: id, name, type, single_stat (delta of just the node in isolation, ignoring travel cost), path_power (full path delta), path_dist (hops from current allocation), power_per_point (path_power / path_dist). Useful objective_stat values: "FullDPS" (aggregate damage; requires set_full_dps_inclusion first), "TotalDPS" (main socket group only), "TotalEHP", "Life", "EnergyShield", "FireResist", or any field in build.calcsTab.mainOutput.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        objective_stat: { type: 'string', description: 'output stat name to maximize' },
        max_hops: {
          type: 'number',
          description:
            'cap on travel distance from current allocation (omit for unlimited; ~5-8 is typical for incremental analysis)',
        },
        top_n: { type: 'number', description: 'return only top N candidates (default 25)' },
      },
      required: ['objective_stat'],
    },
  },
  // PowerBuilder runs synchronously in headless; a full-tree FullDPS pass can take minutes
  bridgeCmd(
    'analyze_tree',
    z.object({
      objective_stat: z.string().min(1),
      max_hops: z.number().int().positive().optional(),
      top_n: z.number().int().positive().optional(),
    }),
    300_000,
  ),
)

export const { definition: resetDef, handler: resetHandler } = defineTool(
  {
    name: 'reset_tree',
    description:
      'Clear every allocated passive tree node. Class start, ascendancy, and ascendancy nodes are preserved. Useful for "start from scratch" SA experiments where the input is a class + gear and you want the tree built up by tool calls. Returns removed count and remaining points_used. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('reset_tree'),
)
