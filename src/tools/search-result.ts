import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getJob } from '../search-jobs.js'

export const definition: Tool = {
  name: 'search_result',
  description:
    'Fetch the result of an async tree search by job_id. While running, returns status running (keep polling search_status). When done, returns the champion build (score, stats, node_ids, points_used), the initial baseline, and the full per-generation trajectory.',
  inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
}

const InputSchema = z.object({ job_id: z.string().min(1) })

export async function handler(_bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { job_id } = InputSchema.parse(args)
    const job = getJob(job_id)
    if (!job) {
      return { content: [{ type: 'text', text: `unknown job_id: ${job_id}` }], isError: true }
    }
    if (job.status === 'error') {
      return {
        content: [{ type: 'text', text: `search failed: ${job.error ?? 'unknown error'}` }],
        isError: true,
      }
    }
    const body = {
      job_id: job.id,
      status: job.status,
      initial: job.initial,
      best: job.best,
      total_evals: job.totalEvals,
      total_generations: job.totalGenerations,
      trajectory: job.trajectory,
    }
    return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
