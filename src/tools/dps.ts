// src/tools/dps.ts
import type { LuaBridge } from '../lua-bridge.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const definition: Tool = {
  name: 'get_dps',
  description: 'Get DPS breakdown for the loaded build. Returns full DPS, average hit, DoT DPS, and minion DPS. Call load_build first.\n\nNote: PoB DPS figures assume ideal config (max charges, flasks up, etc.) unless the build XML has config overrides. These are theoretical maximums, not guaranteed in-game values.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
};

export async function handler(bridge: LuaBridge, _args: unknown): Promise<CallToolResult> {
  try {
    const resp = await bridge.send({ cmd: 'get_dps' });
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    };
  }
}
