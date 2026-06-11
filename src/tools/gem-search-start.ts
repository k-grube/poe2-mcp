import { gemSearchStart } from '../ops/gem-search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'gem_search_start',
    description:
      'Start an async gem-support optimization and return a job_id immediately. Streams progress; poll gem_search_status({job_id}) then gem_search_result({job_id}). ' +
      'objective {stat|weights}, mode {idealized:bool}, scope "main"|"all", minion_skill_index (1-based, see get_minion_skills — pins a Companion gem to that skill instead of iterating), exclude_lineage (drop every lineage support from the candidate pool, useful when the user wants tier-I/II options or a lineage-free rebuild), reroll (gem id from get_socket_groups; keeps every other current support fixed and only fills the freed slot, useful for "find me a better replacement for THIS gem" without disturbing expensive picks). Mutates the live build (revert_build undoes it). Call load_build first.',
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
        exclude_lineage: {
          type: 'boolean',
          description: 'drop every lineage support from the candidate pool',
        },
        reroll: {
          type: 'string',
          description:
            'gem id (Metadata/Items/Gems/...) of a current support to swap out; every other support stays fixed',
        },
        max_supports: {
          type: 'number',
          description:
            'cap the optimizer at this many support slots per group (overrides the 5/idealized or current-count default). useful for partial-link queries like "best 2 supports for this skill"',
        },
      },
    },
  },
  gemSearchStart,
)
