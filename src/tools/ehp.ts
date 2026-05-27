// src/tools/ehp.ts
import type { LuaBridge } from '../lua-bridge.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const definition: Tool = {
  name: 'get_ehp',
  description: 'Get effective HP breakdown for the loaded build: life, ES, ward, armour, evasion, block chance, and spell suppression. Call load_build first.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
};

export async function handler(bridge: LuaBridge, _args: unknown): Promise<CallToolResult> {
  try {
    const resp = await bridge.send({ cmd: 'get_ehp' });
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    };
  }
}
