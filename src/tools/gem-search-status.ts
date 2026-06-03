import { getGemJob } from '../gem-search-jobs.js'
import { defineTool } from './define-tool.js'

// read-only status poll, no bridge call. returns progress + finished results so far.
export const { definition, handler } = defineTool(
  {
    name: 'gem_search_status',
    description: 'Poll a gem search by job_id for status, current progress, and finished per-skill results.',
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
    return {
      job_id: job.id,
      status: job.status,
      groups: job.groups,
      progress: job.progress,
      results: job.results,
      error: job.error,
    }
  },
)
