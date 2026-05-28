// tests/tools/tree.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/tree.js'
import { jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

describe('get_tree_summary tool', () => {
  it('has correct name', () => expect(definition.name).toBe('get_tree_summary'))

  it('returns keystones and notables', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { points_used: 95, keystones: ['Chaos Inoculation'], notables: ['Whispers of Doom'] },
    })
    const result = await handler(mockBridge, {})
    const text = jsonOf<{ keystones: string[]; points_used: number }>(result)
    expect(text.keystones).toContain('Chaos Inoculation')
    expect(text.points_used).toBe(95)
  })
})
