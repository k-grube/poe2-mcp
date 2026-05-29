import { z } from 'zod'
import { requestCancel } from '../search-jobs.js'
import { defineTool } from './define-tool.js'

const InputSchema = z.object({ job_id: z.string().min(1) })

export const { definition, handler } = defineTool(
  {
    name: 'search_cancel',
    description:
      'Request cancellation of a running async tree search by job_id. Cancellation is cooperative: the in-flight generation finishes, then the search stops. The best build found so far is kept and readable via search_result.',
    inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
  },
  async (_bridge, args) => {
    const { job_id } = InputSchema.parse(args)
    if (!requestCancel(job_id)) {
      throw new Error(`unknown job_id: ${job_id}`)
    }
    return { job_id, status: 'cancel_requested' }
  },
)
