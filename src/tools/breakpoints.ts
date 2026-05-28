// src/tools/breakpoints.ts
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const definition: Tool = {
  name: 'get_breakpoints',
  description:
    'Get key stat caps and thresholds for the loaded build: crit cap, hit chance, resistance caps (75% is standard max for each element). Call load_build first.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
}

export async function handler(bridge: LuaBridge, _args: unknown): Promise<CallToolResult> {
  try {
    const resp = await bridge.send({ cmd: 'get_breakpoints' })
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
