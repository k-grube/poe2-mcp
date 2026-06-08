import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition: getDefinition, handler: getHandler } = defineTool(
  {
    name: 'get_socket_groups',
    description:
      'List all socket groups in the loaded build. Each entry has index (1-based), label, enabled, include_in_full_dps, is_main, slot, source, main_skill_name, gem_count. Also returns main_socket_group (index of the group `get_dps` uses for main_*). Each group also includes gems[] (name, support, enabled, level, quality) listing its skill and support gems. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_socket_groups'),
)

const SetFullDpsInput = z
  .object({
    index: z.number().int().positive().optional(),
    indices: z.array(z.number().int().positive()).optional(),
    all_enabled: z.boolean().optional(),
    included: z.boolean(),
  })
  .refine(
    (v) => [v.index !== undefined, v.indices !== undefined, v.all_enabled === true].filter(Boolean).length === 1,
    {
      message: 'provide exactly one of index, indices, or all_enabled=true',
    },
  )

export const { definition: setFullDpsDefinition, handler: setFullDpsHandler } = defineTool(
  {
    name: 'set_full_dps_inclusion',
    description:
      'Toggle the includeInFullDPS flag on socket groups so they contribute to full_dps + skills[] in get_dps. PoB defaults this to false for every group; the in-app equivalent is right-click on a skill -> "Include in Full DPS". Provide one of: index (1-based), indices (array), or all_enabled (true to apply to every enabled group). included is the new boolean value. After this call, get_dps reflects the new aggregation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '1-based socket group index' },
        indices: { type: 'array', items: { type: 'number' }, description: 'multiple 1-based indices' },
        all_enabled: { type: 'boolean', description: 'apply to every enabled socket group' },
        included: { type: 'boolean', description: 'new value for includeInFullDPS' },
      },
      required: ['included'],
    },
  },
  bridgeCmd('set_full_dps_inclusion', SetFullDpsInput),
)

const SetMainInput = z.object({ index: z.number().int().positive() })

export const { definition: setMainDefinition, handler: setMainHandler } = defineTool(
  {
    name: 'set_main_socket_group',
    description:
      "Set which socket group is the build's main (1-based index). The main group drives build_info.main_skill and get_dps.main_dps/main_avg_hit/main_dot_dps. Mutates the live build and rebuilds output.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        index: { type: 'number', description: '1-based socket group index' },
      },
      required: ['index'],
    },
  },
  bridgeCmd('set_main_socket_group', SetMainInput),
)
