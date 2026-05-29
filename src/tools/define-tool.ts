import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export type Handler = (bridge: LuaBridge, args: unknown) => Promise<CallToolResult>

// a tool's logic: return the data to serialize, or throw to produce an isError result
export type ToolBody = (bridge: LuaBridge, args: unknown) => Promise<unknown>

interface Parser {
  parse: (value: unknown) => unknown
}

// run a body, serialize its return as pretty JSON, and turn any thrown error into
// an isError result. the response + error shape lives here, not in every tool.
export function defineTool(definition: Tool, body: ToolBody): { definition: Tool; handler: Handler } {
  const handler: Handler = async (bridge, args) => {
    try {
      const data = await body(bridge, args)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
        isError: true,
      }
    }
  }
  return { definition, handler }
}

// body for the common case: optionally validate args, send one bridge command,
// return its data. pass a zod schema to validate; omit for no-arg tools.
export function bridgeCmd(cmd: string, schema?: Parser, timeoutMs?: number): ToolBody {
  return async (bridge, args) => {
    const parsed = schema ? (schema.parse(args) as Record<string, unknown>) : undefined
    const resp = await bridge.send({ cmd, args: parsed, timeoutMs })
    return resp.data
  }
}
