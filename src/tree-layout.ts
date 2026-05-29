import type { LuaBridge } from './lua-bridge.js'
import type { ToolBody } from './tools/define-tool.js'
import { httpRoute } from './http-route.js'

// tree layout never changes for the process lifetime; cache after first dump.
// factory so the cache is per-instance and the handler is unit-testable. the
// cached fetch is a plain op, exposed over http by the shared httpRoute adapter.
export function createTreeLayoutHandler(bridge: LuaBridge) {
  let cache: unknown = null
  const op: ToolBody = async (b) => {
    if (!cache) {
      const resp = await b.send({ cmd: 'get_tree_layout' })
      cache = resp.data
    }
    return cache
  }
  return httpRoute(bridge, op)
}
