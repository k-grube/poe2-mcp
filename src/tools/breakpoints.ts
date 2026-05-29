import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_breakpoints',
    description:
      'Get key stat caps and thresholds for the loaded build: crit cap, hit chance, resistance caps (75% is standard max for each element). Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_breakpoints'),
)
