import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_tree_summary',
    description:
      'Summarise the passive tree for the loaded build: points used, keystones allocated, and notable passives. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_tree_summary'),
)
