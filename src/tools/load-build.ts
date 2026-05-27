// src/tools/load-build.ts
import { z } from 'zod';
import type { LuaBridge } from '../lua-bridge.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const definition: Tool = {
  name: 'load_build',
  description: 'Load a PathOfBuilding2 build from a PoB XML export string. Must be called before any other build-evaluation tools.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pob_code: {
        type: 'string',
        description: 'Full PoB2 XML export string (copy from PoB2 -> Export/Share -> Copy XML)',
      },
    },
    required: ['pob_code'],
  },
};

const InputSchema = z.object({ pob_code: z.string().min(1) });

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { pob_code } = InputSchema.parse(args);
    const resp = await bridge.send({ cmd: 'load_build', args: { code: pob_code } });
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    };
  }
}
