import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { dbg } from '../debug.js'

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
  setMainDefinition as sgSetMainDef,
  setMainHandler as sgSetMainHandler,
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
  resetDef,
  resetHandler,
} from './tree-nodes.js'
import { definition as searchStartDef, handler as searchStartHandler } from './search-start.js'
import { definition as searchStatusDef, handler as searchStatusHandler } from './search-status.js'
import { definition as searchResultDef, handler as searchResultHandler } from './search-result.js'
import { definition as searchCancelDef, handler as searchCancelHandler } from './search-cancel.js'
import { definition as buildInfoDef, handler as buildInfoHandler } from './build-info.js'
import { definition as buildSummaryDef, handler as buildSummaryHandler } from './build-summary.js'
import { definition as compareCompanionsDef, handler as compareCompanionsHandler } from './compare-companions.js'
import {
  getDefinition as msGetDef,
  getHandler as msGetHandler,
  setDefinition as msSetDef,
  setHandler as msSetHandler,
} from './minion-skills.js'
import { definition as exportDef, handler as exportHandler } from './export-build.js'
import { definition as revertDef, handler as revertHandler } from './revert-build.js'
import { definition as gemSearchDef, handler as gemSearchHandler } from './gem-search.js'
import { definition as gemStartDef, handler as gemStartHandler } from './gem-search-start.js'
import { definition as gemStatusDef, handler as gemStatusHandler } from './gem-search-status.js'
import { definition as gemResultDef, handler as gemResultHandler } from './gem-search-result.js'
import { definition as gemCancelDef, handler as gemCancelHandler } from './gem-search-cancel.js'

type Handler = (bridge: LuaBridge, args: unknown) => Promise<CallToolResult>

const entries: Array<{ definition: Tool; handler: Handler }> = [
  { definition: loadBuildDef, handler: loadBuildHandler },
  { definition: buildInfoDef, handler: buildInfoHandler },
  { definition: buildSummaryDef, handler: buildSummaryHandler },
  { definition: compareCompanionsDef, handler: compareCompanionsHandler },
  { definition: msGetDef, handler: msGetHandler },
  { definition: msSetDef, handler: msSetHandler },
  { definition: dpsDef, handler: dpsHandler },
  { definition: ehpDef, handler: ehpHandler },
  { definition: bpDef, handler: bpHandler },
  { definition: swapDef, handler: swapHandler },
  { definition: treeDef, handler: treeHandler },
  { definition: updateDef, handler: updateHandler },
  { definition: sgGetDef, handler: sgGetHandler },
  { definition: sgSetDef, handler: sgSetHandler },
  { definition: sgSetMainDef, handler: sgSetMainHandler },
  { definition: getAllocatedDef, handler: getAllocatedHandler },
  { definition: allocateDef, handler: allocateHandler },
  { definition: deallocateDef, handler: deallocateHandler },
  { definition: analyzeDef, handler: analyzeHandler },
  { definition: resetDef, handler: resetHandler },
  { definition: searchStartDef, handler: searchStartHandler },
  { definition: searchStatusDef, handler: searchStatusHandler },
  { definition: searchResultDef, handler: searchResultHandler },
  { definition: searchCancelDef, handler: searchCancelHandler },
  { definition: exportDef, handler: exportHandler },
  { definition: revertDef, handler: revertHandler },
  { definition: gemSearchDef, handler: gemSearchHandler },
  { definition: gemStartDef, handler: gemStartHandler },
  { definition: gemStatusDef, handler: gemStatusHandler },
  { definition: gemResultDef, handler: gemResultHandler },
  { definition: gemCancelDef, handler: gemCancelHandler },
]

export const toolDefinitions: Tool[] = entries.map((e) => e.definition)

const handlerMap = new Map<string, Handler>(entries.map((e) => [e.definition.name, e.handler]))

export function dispatchTool(name: string, bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  dbg(`[dispatch] tool=${name}\n`)
  const h = handlerMap.get(name)
  if (!h) {
    return Promise.resolve({
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    })
  }
  return h(bridge, args)
}
