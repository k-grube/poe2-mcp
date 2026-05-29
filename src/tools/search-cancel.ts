import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { requestCancel } from '../search-jobs.js'

export const definition: Tool = {
  name: 'search_cancel',
  description:
    'Request cancellation of a running async tree search by job_id. Cancellation is cooperative: the in-flight generation finishes, then the search stops. The best build found so far is kept and readable via search_result.',
  inputSchema: { type: 'object' as const, properties: { job_id: { type: 'string' } }, required: ['job_id'] },
}

const InputSchema = z.object({ job_id: z.string().min(1) })

export async function handler(_bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { job_id } = InputSchema.parse(args)
    const ok = requestCancel(job_id)
    if (!ok) {
      return { content: [{ type: 'text', text: `unknown job_id: ${job_id}` }], isError: true }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ job_id, status: 'cancel_requested' }, null, 2) }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
