// src/tools/update-pob2.ts
import { z } from 'zod';
import { cloneOrPull } from '../pob-manager.js';
import type { LuaBridge } from '../lua-bridge.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const definition: Tool = {
  name: 'update_pob2',
  description: 'Pull the latest PathOfBuilding-PoE2 from GitHub and restart the Lua subprocess. Use after a new PoE2 patch to get updated gem data.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      branch: { type: 'string', description: 'Branch to pull (default: dev). Use "master" for the last stable release.' },
    },
    required: [],
  },
};

const InputSchema = z.object({ branch: z.string().optional() });

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const { branch } = InputSchema.parse(args ?? {});
    if (branch) {
      process.env.POB2_BRANCH = branch;
    }
    const result = await cloneOrPull(branch);
    await bridge.restart();
    return {
      content: [{ type: 'text', text: JSON.stringify({ action: result.action, head: result.head, branch: branch ?? process.env.POB2_BRANCH ?? 'dev' }, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    };
  }
}
