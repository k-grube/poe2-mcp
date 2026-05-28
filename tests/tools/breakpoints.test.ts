// tests/tools/breakpoints.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/breakpoints.js'
import { jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

describe('get_breakpoints tool', () => {
  it('has correct name', () => expect(definition.name).toBe('get_breakpoints'))

  it('reports crit cap status correctly', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: {
        crit_chance: 100,
        crit_capped: true,
        hit_chance: 95,
        fire_res: 75,
        fire_res_capped: true,
        cold_res: 50,
        cold_res_capped: false,
        lightning_res: 75,
        lightning_res_capped: true,
        chaos_res: -60,
      },
    })
    const result = await handler(mockBridge, {})
    const text = jsonOf<{ crit_capped: boolean; cold_res_capped: boolean }>(result)
    expect(text.crit_capped).toBe(true)
    expect(text.cold_res_capped).toBe(false)
  })
})
