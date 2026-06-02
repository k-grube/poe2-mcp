import type { Request, Response } from 'express'
import type { LuaBridge } from './lua-bridge.js'
import type { ToolBody } from './tools/define-tool.js'

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// http adapter for a shared op (ToolBody). defineTool wraps the op for the mcp,
// httpRoute wraps the same op for the viz. parseInput pulls the op's args from the
// request (req.body for POST, req.query for GET); default no input. parse failures
// -> 400, op failures -> 409 (matches tree-layout's no-build-loaded case).
export function httpRoute(bridge: LuaBridge, body: ToolBody, parseInput: (req: Request) => unknown = () => undefined) {
  return async (req: Request, res: Response): Promise<void> => {
    let input: unknown
    try {
      input = parseInput(req)
    } catch (err) {
      res.status(400).json({ error: msg(err) })
      return
    }
    try {
      const data = await body(bridge, input)
      res.json(data)
    } catch (err) {
      res.status(409).json({ error: msg(err) })
    }
  }
}
