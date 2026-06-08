import { gemSearchStart } from '../ops/gem-search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'gem_search_start',
    description:
      'Start an async gem-support optimization and return a job_id immediately. Streams progress; poll gem_search_status({job_id}) then gem_search_result({job_id}). ' +
      'objective {stat|weights}, mode {idealized:bool}, scope "main"|"all", minion_skill_index (1-based, see get_minion_skills — pins a Companion gem to that skill instead of iterating). Mutates the live build (revert_build undoes it). Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        objective: { type: 'object', description: 'e.g. {"stat":"FullDPS"}' },
        mode: { type: 'object', description: '{"idealized":true|false}' },
        scope: { description: '"main" (default), "all", or socket-group indices' },
        minion_skill_index: {
          type: 'number',
          description: 'pin a Companion gem to this minion skill index instead of iterating',
        },
      },
    },
  },
  gemSearchStart,
)
