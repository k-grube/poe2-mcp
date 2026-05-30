import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_build_info',
    description: 'Header for the loaded build: class_name, ascendancy, level, main_skill. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_build_info'),
)
