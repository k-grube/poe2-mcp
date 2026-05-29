import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_ehp',
    description:
      'Get effective HP breakdown for the loaded build: life, ES, ward, armour, evasion, block chance, and spell suppression. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_ehp'),
)
