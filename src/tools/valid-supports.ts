import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

const Input = z.object({
  group: z.number().int().positive().optional(),
  as_imported: z.boolean().optional(),
})

export const { definition, handler } = defineTool(
  {
    name: 'get_valid_supports',
    description:
      "List every support gem PoB considers valid for a socket group's active skill (passes canGrantedEffectSupportActiveSkill + attribute feasibility). Returns { group, supports[] } with each entry { id, name, lineage, family }. Defaults: group = main socket group, mode = idealized (ignore attribute requirements). Pass as_imported: true to filter by the build's current Str/Dex/Int. Useful for sanity-checking the candidate pool size before running gem_search. Call load_build first.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        group: { type: 'number', description: '1-based socket group index (default: main socket group)' },
        as_imported: {
          type: 'boolean',
          description: "filter by character's current Str/Dex/Int instead of assuming attrs are met",
        },
      },
      required: [],
    },
  },
  bridgeCmd('get_valid_supports', Input),
)
