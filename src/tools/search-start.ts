import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { SearchInputSchema, searchInputProperties } from './search-schema.js'
import { startSearch } from '../search-jobs.js'

export const definition: Tool = {
  name: 'search_start',
  description:
    'Start an async memetic-GA tree search and return a job_id immediately. The search runs server-side in the background and survives client disconnect. Poll search_status({job_id}) for progress (~every 5s), then search_result({job_id}) for the champion build. Only one search runs at a time. ' +
    'objective: { stat: "FullDPS" } or { weights: { FullDPS: 1.0, TotalEHP: 0.3 } }. ' +
    'start_mode "fresh" resets the tree first (loses ascendancy nodes). ' +
    'Call load_build first.',
  inputSchema: { type: 'object' as const, properties: searchInputProperties, required: ['objective'] },
}

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = SearchInputSchema.parse(args)
    const job = await startSearch(bridge, parsed)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              job_id: job.id,
              status: job.status,
              total_generations: job.totalGenerations,
              initial_score: job.initial?.score ?? null,
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
