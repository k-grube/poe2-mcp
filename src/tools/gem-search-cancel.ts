import { gemSearchCancel } from '../ops/gem-search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'gem_search_cancel',
    description: 'Cancel a running gem search by job_id.',
    inputSchema: {
      type: 'object' as const,
      properties: { job_id: { type: 'string', description: 'the gem search job id' } },
      required: ['job_id'],
    },
  },
  gemSearchCancel,
)
