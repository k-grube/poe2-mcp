import { z } from 'zod'
import { defineTool } from './define-tool.js'

const InputSchema = z.object({ slot: z.string().min(1), new_gem: z.string().min(1) })

export const { definition, handler } = defineTool(
  {
    name: 'compare_gem_swap',
    description:
      'Swap a gem in a skill slot and compare DPS before/after. Automatically restores the original gem after comparison.\n\nNote: slot is the skill slot label from PoB2 (e.g. "1", "2", or the slot name). new_gem is the gem name as it appears in PoB2.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slot: { type: 'string', description: 'Skill slot identifier (e.g. "1")' },
        new_gem: { type: 'string', description: 'Gem name to swap in (e.g. "Brutality")' },
      },
      required: ['slot', 'new_gem'],
    },
  },
  async (bridge, args) => {
    const { slot, new_gem } = InputSchema.parse(args)
    const resp = await bridge.send({ cmd: 'compare_gem_swap', args: { slot, gem: new_gem } })
    return resp.data
  },
)
