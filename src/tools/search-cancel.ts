import { searchCancel } from '../ops/search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'search_cancel',
    description:
      'Request cancellation of a running async tree search by job_id. Cancellation is cooperative: the in-flight generation finishes, then the search stops. The best build found so far is kept and readable via search_result.',
    inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
  },
  searchCancel,
)
