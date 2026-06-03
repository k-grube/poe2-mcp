import { deflateSync } from 'node:zlib'
import type { ToolBody } from '../tools/define-tool.js'

// serialize the active build to a PoB share code: xml -> zlib -> url-safe base64,
// the exact inverse of load-build's decode. no input. lua errors -> 409 if no build.
export const exportBuild: ToolBody = async (bridge) => {
  const { xml } = (await bridge.send({ cmd: 'save_build' })).data as { xml: string }
  const code = deflateSync(Buffer.from(xml, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
  return { pob_code: code }
}
