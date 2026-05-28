import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import { definition as loadBuildDef, handler as loadBuildHandler } from './load-build.js'
import { definition as dpsDef, handler as dpsHandler } from './dps.js'
import { definition as ehpDef, handler as ehpHandler } from './ehp.js'
import { definition as bpDef, handler as bpHandler } from './breakpoints.js'
import { definition as swapDef, handler as swapHandler } from './gem-swap.js'
import { definition as treeDef, handler as treeHandler } from './tree.js'
import { definition as updateDef, handler as updateHandler } from './update-pob2.js'
import {
  getDefinition as sgGetDef,
  getHandler as sgGetHandler,
  setFullDpsDefinition as sgSetDef,
  setFullDpsHandler as sgSetHandler,
} from './socket-groups.js'
import {
  getAllocatedDef,
  getAllocatedHandler,
  allocateDef,
  allocateHandler,
  deallocateDef,
  deallocateHandler,
  analyzeDef,
  analyzeHandler,
} from './tree-nodes.js'

type Handler = (bridge: LuaBridge, args: unknown) => Promise<CallToolResult>

const entries: Array<{ definition: Tool; handler: Handler }> = [
  { definition: loadBuildDef, handler: loadBuildHandler },
  { definition: dpsDef, handler: dpsHandler },
  { definition: ehpDef, handler: ehpHandler },
  { definition: bpDef, handler: bpHandler },
  { definition: swapDef, handler: swapHandler },
  { definition: treeDef, handler: treeHandler },
  { definition: updateDef, handler: updateHandler },
  { definition: sgGetDef, handler: sgGetHandler },
  { definition: sgSetDef, handler: sgSetHandler },
  { definition: getAllocatedDef, handler: getAllocatedHandler },
  { definition: allocateDef, handler: allocateHandler },
  { definition: deallocateDef, handler: deallocateHandler },
  { definition: analyzeDef, handler: analyzeHandler },
]

export const toolDefinitions: Tool[] = entries.map((e) => e.definition)

const handlerMap = new Map<string, Handler>(entries.map((e) => [e.definition.name, e.handler]))

export function dispatchTool(name: string, bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  process.stderr.write(`[dispatch] tool=${name}\n`)
  const h = handlerMap.get(name)
  if (!h) {
    return Promise.resolve({
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    })
  }
  return h(bridge, args)
}
