import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// narrows CallToolResult.content[0] to a text block and pulls out the text
export function textOf(result: CallToolResult): string {
  const block = result.content[0]
  if (!block || block.type !== 'text') {
    throw new Error(`expected text content block, got ${block?.type ?? 'undefined'}`)
  }
  return block.text
}

// shortcut for tools that return JSON-as-text
export function jsonOf<T = unknown>(result: CallToolResult): T {
  return JSON.parse(textOf(result)) as T
}
