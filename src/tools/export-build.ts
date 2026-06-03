import { exportBuild } from '../ops/export-build.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'export_build',
    description:
      'Export the active build as a PathOfBuilding2 share code (the inverse of load_build) so it can be re-imported into PoB. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  exportBuild,
)
