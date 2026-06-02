import { z } from 'zod'
import { SearchInputSchema } from '../tools/search-schema.js'
import { startSearch, requestCancel } from '../search-jobs.js'
import type { ToolBody } from '../tools/define-tool.js'

// start an async memetic-GA tree search; returns a job summary immediately. throws
// "a search is already running" if one is active (startSearch enforces it).
export const searchStart: ToolBody = async (bridge, args) => {
  const parsed = SearchInputSchema.parse(args)
  const job = await startSearch(bridge, parsed)
  return {
    job_id: job.id,
    status: job.status,
    total_generations: job.totalGenerations,
    initial_score: job.initial?.score ?? null,
  }
}

const CancelInput = z.object({ job_id: z.string().min(1) })

// cooperative cancel of a running search by job_id
export const searchCancel: ToolBody = async (_bridge, args) => {
  const { job_id } = CancelInput.parse(args)
  if (!requestCancel(job_id)) {
    throw new Error(`unknown job_id: ${job_id}`)
  }
  return { job_id, status: 'cancel_requested' }
}
