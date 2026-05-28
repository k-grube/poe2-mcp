// src/tools/tree-nodes.ts
import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

async function call(
  bridge: LuaBridge,
  cmd: string,
  args?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<CallToolResult> {
  try {
    const wire: { cmd: string; args?: Record<string, unknown>; timeoutMs?: number } = { cmd }
    if (args) {
      wire.args = args
    }
    if (timeoutMs) {
      wire.timeoutMs = timeoutMs
    }
    const resp = await bridge.send(wire)
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}

// get_allocated_nodes

export const getAllocatedDef: Tool = {
  name: 'get_allocated_nodes',
  description:
    "List every allocated node on the passive tree. Each entry: id, name, type (keystone/notable/normal/mastery/ascendancy/class_start/ascend_start/jewel_socket), ascendancy (if applicable), stats (array of stat description lines). Response also has points_used and ascendancy_points_used (PoB's actual counts, excluding class/ascend starts). Call load_build first.",
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
}

export async function getAllocatedHandler(bridge: LuaBridge, _args: unknown): Promise<CallToolResult> {
  return call(bridge, 'get_allocated_nodes')
}

// allocate_node

export const allocateDef: Tool = {
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
}

const AllocateInput = z.object({ id: z.number().int().positive() })

export async function allocateHandler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { id } = AllocateInput.parse(args)
    return await call(bridge, 'allocate_node', { id })
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}

// deallocate_node

export const deallocateDef: Tool = {
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
}

const DeallocateInput = z.object({ id: z.number().int().positive() })

export async function deallocateHandler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { id } = DeallocateInput.parse(args)
    return await call(bridge, 'deallocate_node', { id })
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}

// analyze_tree

export const analyzeDef: Tool = {
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
}

const AnalyzeInput = z.object({
  objective_stat: z.string().min(1),
  max_hops: z.number().int().positive().optional(),
  top_n: z.number().int().positive().optional(),
})

export async function analyzeHandler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = AnalyzeInput.parse(args)
    // PowerBuilder runs synchronously in headless (GetTime is stubbed so the
    // coroutine never yields). full-tree FullDPS pass can take minutes.
    return await call(bridge, 'analyze_tree', parsed, 300_000)
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
