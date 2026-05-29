import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getJob } from '../search-jobs.js'

export const definition: Tool = {
  name: 'search_status',
  description:
    'Poll an async tree search by job_id. Returns status (running|done|error|cancelled), generations completed, and the latest trajectory point. Poll ~every 5s while running, then call search_result.',
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
    const latest = job.trajectory[job.trajectory.length - 1] ?? null
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              job_id: job.id,
              status: job.status,
              generation: latest?.generation ?? 0,
              total_generations: job.totalGenerations,
              champion_score: latest?.champion_score ?? job.initial?.score ?? null,
              latest,
              error: job.error,
            },
            null,
            2,
          ),
        },
      ],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
