// src/tools/gem-swap.ts
import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const definition: Tool = {
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
}

const InputSchema = z.object({ slot: z.string().min(1), new_gem: z.string().min(1) })

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { slot, new_gem } = InputSchema.parse(args)
    const resp = await bridge.send({ cmd: 'compare_gem_swap', args: { slot, gem: new_gem } })
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
