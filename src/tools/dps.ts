import { defineTool, bridgeCmd } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'get_dps',
    description:
      'Get DPS breakdown for the loaded build. Returns: full_dps (aggregate of all enabled damage skills), full_dot_dps, main_dps + main_avg_hit + main_dot_dps (the main socket group only), minion_dps, and skills[] (per-skill breakdown sorted by dps desc, each entry has name + dps + count + optional trigger/source/skill_part). Call load_build first.\n\nNote: PoB DPS figures assume ideal config (max charges, flasks up, etc.) unless the build XML has config overrides. These are theoretical maximums, not guaranteed in-game values.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  bridgeCmd('get_dps'),
)
