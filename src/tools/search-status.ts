import { z } from 'zod'
import { getJob } from '../search-jobs.js'
import { defineTool } from './define-tool.js'

const InputSchema = z.object({ job_id: z.string().min(1) })

export const { definition, handler } = defineTool(
  {
    name: 'search_status',
    description:
      'Poll an async tree search by job_id. Returns status (running|done|error|cancelled), generations completed, and the latest trajectory point. Poll ~every 5s while running, then call search_result.',
    inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
  },
  async (_bridge, args) => {
    const { job_id } = InputSchema.parse(args)
    const job = getJob(job_id)
    if (!job) {
      throw new Error(`unknown job_id: ${job_id}`)
    }
    const latest = job.trajectory[job.trajectory.length - 1] ?? null
    return {
      job_id: job.id,
      status: job.status,
      generation: latest?.generation ?? 0,
      total_generations: job.totalGenerations,
      champion_score: latest?.champion_score ?? job.initial?.score ?? null,
      latest,
      error: job.error,
    }
  },
)
