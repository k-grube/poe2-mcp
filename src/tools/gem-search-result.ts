import { getGemJob } from '../gem-search-jobs.js'
import { defineTool } from './define-tool.js'

// final per-skill results; errors if the job is still running
export const { definition, handler } = defineTool(
  {
    name: 'gem_search_result',
    description:
      'Get the final per-skill gem recommendations (supports added/removed/kept + score delta) for a finished job_id.',
    inputSchema: {
      type: 'object' as const,
      properties: { job_id: { type: 'string', description: 'the gem search job id' } },
      required: ['job_id'],
    },
  },
  async (_bridge, args) => {
    const { job_id } = (args ?? {}) as { job_id?: string }
    const job = job_id ? getGemJob(job_id) : undefined
    if (!job) {
      throw new Error(`unknown job_id: ${job_id}`)
    }
    if (job.status === 'running') {
      throw new Error('gem search still running; poll gem_search_status')
    }
    return { job_id: job.id, status: job.status, results: job.results, error: job.error }
  },
)
