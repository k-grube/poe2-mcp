import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { z } from 'zod'
import type { ToolBody } from '../tools/define-tool.js'
import { setActiveBuild } from '../active-build.js'
import type { BuildInfo } from '../wire-types.js'

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

// load a build into the lua subprocess, record it as the active build, notify
// viewers. shared by the mcp tool and the POST /api/load-build route.
export const loadBuild: ToolBody = async (bridge, args) => {
  const parsed = InputSchema.parse(args)
  const raw = parsed.pob_code ?? readFileSync(parsed.pob_code_path!, 'utf8')
  const xml = decodePobCode(raw)
  const resp = await bridge.send({ cmd: 'load_build', args: { code: xml } })
  const info = resp.data as BuildInfo
  setActiveBuild(info)
  return info
}
