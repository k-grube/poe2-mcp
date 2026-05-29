import type { Request, Response } from 'express'
import type { LuaBridge } from './lua-bridge.js'

// tree layout never changes for the process lifetime; cache after first dump.
// factory so the cache is per-instance and the handler is unit-testable.
export function createTreeLayoutHandler(bridge: LuaBridge) {
  let cache: unknown = null
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!cache) {
        const resp = await bridge.send({ cmd: 'get_tree_layout' })
        cache = resp.data
      }
      res.json(cache)
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) })
    }
  }
}
