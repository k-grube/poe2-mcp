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
      'Returns per-skill recommended supports and the score delta. Mutates the live build (revert_build undoes it). ' +
      'Runs synchronously and can take tens of seconds per skill. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        objective: { type: 'object', description: 'optimization objective, e.g. {"stat":"FullDPS"}' },
        mode: { type: 'object', description: '{"idealized":true} for endgame, {"idealized":false} for as-imported' },
        scope: { description: '"main" (default), "all", or an array of socket-group indices' },
      },
    },
  },
  gemSearch,
)
