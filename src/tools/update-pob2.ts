import { z } from 'zod'
import { cloneOrPull } from '../pob-manager.js'
import { defineTool } from './define-tool.js'

const InputSchema = z.object({ branch: z.string().optional() })

export const { definition, handler } = defineTool(
  {
    name: 'update_pob2',
    description:
      'Pull the latest PathOfBuilding-PoE2 from GitHub and restart the Lua subprocess. Use after a new PoE2 patch to get updated gem data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        branch: {
          type: 'string',
          description: 'Branch to pull (default: dev). Use "master" for the last stable release.',
        },
      },
      required: [],
    },
  },
  async (bridge, args) => {
    const { branch } = InputSchema.parse(args ?? {})
    if (branch) {
      process.env.POB2_BRANCH = branch
    }
    const result = await cloneOrPull(branch)
    await bridge.restart()
    return { action: result.action, head: result.head, branch: branch ?? process.env.POB2_BRANCH ?? 'dev' }
  },
)
