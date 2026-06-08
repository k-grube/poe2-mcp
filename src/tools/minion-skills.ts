import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition: getDefinition, handler: getHandler } = defineTool(
  {
    name: 'get_minion_skills',
    description:
      'List every Companion gem in the loaded build with its available minion skills. Each entry: group (1-based socket group index), gem (e.g. "Companion: Zekoa, the Headcrusher"), beast (e.g. "Zekoa, the Headcrusher"), current_skill_index (what skillMinionSkill is set to), skills[] (each entry: index + name like "Pillar Slam"). Use the index with set_minion_skill or gem_search { minion_skill_index }. Call load_build first.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_minion_skills'),
)

const SetInput = z.object({
  group: z.number().int().positive(),
  skill_index: z.number().int().positive(),
})

export const { definition: setDefinition, handler: setHandler } = defineTool(
  {
    name: 'set_minion_skill',
    description:
      'Set which minion skill (skillMinionSkill index) a Companion gem uses for DPS calc. Mutates the live build and rebuilds output, so get_dps and downstream metrics reflect the choice. group is the 1-based socket group index, skill_index is 1-based from get_minion_skills. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        group: { type: 'number', description: '1-based socket group index' },
        skill_index: { type: 'number', description: '1-based minion skill index (see get_minion_skills)' },
      },
      required: ['group', 'skill_index'],
    },
  },
  bridgeCmd('set_minion_skill', SetInput),
)
