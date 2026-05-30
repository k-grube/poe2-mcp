import { defineTool } from './define-tool.js'
import { getBuildSummary } from '../ops/build-summary.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_build_summary',
    description:
      'One-call read-only summary of the loaded build: info (class/ascendancy/level/main_skill), dps, ehp, breakpoints, tree (points/keystones/notables), and socket_groups (each with its gems + support gems). Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  getBuildSummary,
)
