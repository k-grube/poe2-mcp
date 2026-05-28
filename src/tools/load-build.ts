// src/tools/load-build.ts
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const definition: Tool = {
  name: 'load_build',
  description:
    'Load a PathOfBuilding2 build. Provide ONE of: pob_code (the share code or raw XML inline), or pob_code_path (a server-side file path containing the share code or XML). Path form avoids burning model context on large blobs. Must be called before any other build-evaluation tools.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pob_code: {
        type: 'string',
        description: 'PoB2 share code (base64 string from Export/Share -> Copy) or raw XML, inline',
      },
      pob_code_path: {
        type: 'string',
        description:
          'Path to a file containing the PoB2 share code or XML. Absolute, or relative to the server process cwd',
      },
    },
  },
}

const InputSchema = z
  .object({
    pob_code: z.string().min(1).optional(),
    pob_code_path: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.pob_code) !== Boolean(v.pob_code_path), {
    message: 'provide exactly one of pob_code or pob_code_path',
  })

// pob share codes are url-safe-base64(zlib(xml)). raw xml starts with `<`.
function decodePobCode(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('<')) {
    return trimmed
  }
  const standardB64 = trimmed.replace(/-/g, '+').replace(/_/g, '/')
  const compressed = Buffer.from(standardB64, 'base64')
  return inflateSync(compressed).toString('utf8')
}

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = InputSchema.parse(args)
    const raw = parsed.pob_code ?? readFileSync(parsed.pob_code_path!, 'utf8')
    const xml = decodePobCode(raw)
    const resp = await bridge.send({ cmd: 'load_build', args: { code: xml } })
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
