import { gemSearch } from '../ops/gem-search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'gem_search',
    description:
      'Optimize support gems for the loaded build. ' +
      'objective: { stat: "FullDPS" } or { weights: {...} }. ' +
      'mode: { idealized: true } (level 20, Q20, 5 sockets) or { idealized: false } (as-imported). ' +
      'scope: "main" (default), "all", or an array of socket-group indices. ' +
      "minion_skill_index: 1-based index into a Companion gem's minion skills (see get_minion_skills). When set, the optimizer pins the minion to that skill instead of iterating every minion skill per support trial (~3x faster). Default: iterate and pick the best per trial. " +
      'Returns per-skill recommended supports and the score delta. Mutates the live build (revert_build undoes it). ' +
      'Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        objective: { type: 'object', description: 'optimization objective, e.g. {"stat":"FullDPS"}' },
        mode: { type: 'object', description: '{"idealized":true} for endgame, {"idealized":false} for as-imported' },
        scope: { description: '"main" (default), "all", or an array of socket-group indices' },
        minion_skill_index: {
          type: 'number',
          description: 'pin a Companion gem to this minion skill index instead of iterating',
        },
      },
    },
  },
  gemSearch,
)
