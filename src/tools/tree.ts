// src/tools/tree.ts
import type { LuaBridge } from '../lua-bridge.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const definition: Tool = {
  name: 'get_tree_summary',
  description: 'Summarise the passive tree for the loaded build: points used, keystones allocated, and notable passives. Call load_build first.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
};

export async function handler(bridge: LuaBridge, _args: unknown): Promise<CallToolResult> {
  try {
    const resp = await bridge.send({ cmd: 'get_tree_summary' });
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    };
  }
}
