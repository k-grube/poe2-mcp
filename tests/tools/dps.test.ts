// tests/tools/dps.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/dps.js'
import { jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

describe('get_dps tool', () => {
  it('definition has correct name and no required inputs', () => {
    expect(definition.name).toBe('get_dps')
    expect(definition.inputSchema.required ?? []).toHaveLength(0)
  })

  it('returns dps breakdown', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { full_dps: 1_000_000, avg_hit: 50_000, dot_dps: 200_000, minion_dps: 0 },
    })
    const result = await handler(mockBridge, {})
    const text = jsonOf<{ full_dps: number }>(result)
    expect(text.full_dps).toBe(1_000_000)
  })

  it('returns error when no build loaded', async () => {
    vi.mocked(mockBridge.send).mockRejectedValueOnce(new Error('no build loaded'))
    const result = await handler(mockBridge, {})
    expect(result.isError).toBe(true)
  })
})
