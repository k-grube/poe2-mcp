import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

const Input = z.object({
  group: z.number().int().positive().optional(),
  beasts: z.array(z.string().min(1)).optional(),
  scope: z.enum(['library', 'all']).optional(),
})

export const { definition, handler } = defineTool(
  {
    name: 'compare_companions',
    description:
      'For one Companion socket group, swap the beast (skillMinion) across a candidate set, and for each beast iterate every minion skill (skillMinionSkill index), rebuilding per swap. Reports each beast\'s best minion skill + max DPS. Returns results[] sorted by dps desc: { beast_id, beast_name, dps, best_skill, best_skill_index, skills_evaluated }. Defaults: group = main socket group, candidates = the user\'s beast library (build.beastList). Pass scope="all" to evaluate every beast in PoB data (~hundreds, slow — multiple BuildOutput calls per beast). Pass beasts=[metadataIds] for an explicit list. The original beast + skill selection are restored before returning. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        group: {
          type: 'number',
          description: '1-based socket group index containing a Companion gem (default: main socket group)',
        },
        beasts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Explicit metadata ids to evaluate, e.g. "Metadata/Monsters/.../QuadrillaBossMinion2"',
        },
        scope: {
          type: 'string',
          enum: ['library', 'all'],
          description: 'library = build.beastList (default), all = every Beast in PoB data',
        },
      },
      required: [],
    },
  },
  bridgeCmd('compare_companions', Input, 120_000),
)
