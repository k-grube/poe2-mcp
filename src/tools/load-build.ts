import { loadBuild } from '../ops/load-build.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'load_build',
    description:
      'Load a PathOfBuilding2 build. Provide ONE of: pob_code (the share code or raw XML inline), or pob_code_path (a server-side file path containing the share code or XML). Path form avoids burning model context on large blobs. Must be called before any other build-evaluation tools.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pob_code: {
          type: 'string',
          description: 'PoB2 share code (base64 string from Export/Share -> Copy) or raw XML, inline',
        },
        pob_code_path: {
          type: 'string',
          description:
            'Path to a file containing the PoB2 share code or XML. Absolute, or relative to the server process cwd',
        },
      },
    },
  },
  loadBuild,
)
