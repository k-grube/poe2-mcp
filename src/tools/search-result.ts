import { z } from 'zod'
import { getJob } from '../search-jobs.js'
import { defineTool } from './define-tool.js'

const InputSchema = z.object({ job_id: z.string().min(1) })

export const { definition, handler } = defineTool(
  {
    name: 'search_result',
    description:
      'Fetch the result of an async tree search by job_id. While running, returns status running (keep polling search_status). When done, returns the champion build (score, stats, node_ids, points_used), the initial baseline, and the full per-generation trajectory.',
    inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
  },
  async (_bridge, args) => {
    const { job_id } = InputSchema.parse(args)
    const job = getJob(job_id)
    if (!job) {
      throw new Error(`unknown job_id: ${job_id}`)
    }
    if (job.status === 'error') {
      throw new Error(`search failed: ${job.error ?? 'unknown error'}`)
    }
    return {
      job_id: job.id,
      status: job.status,
      initial: job.initial,
      best: job.best,
      total_evals: job.totalEvals,
      total_generations: job.totalGenerations,
      trajectory: job.trajectory,
    }
  },
)
