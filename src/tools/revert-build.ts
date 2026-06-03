import { revertBuild } from '../ops/revert-build.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'revert_build',
    description:
      'Restore the active build to its state before the last tree search ran (undo the search champion). Errors if no search has run on this build.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  revertBuild,
)
