// tests/tools/ehp.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/ehp.js'
import { jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

describe('get_ehp tool', () => {
  it('has correct name', () => expect(definition.name).toBe('get_ehp'))

  it('returns ehp breakdown', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: {
        life: 5000,
        es: 0,
        ward: 0,
        total_ehp: 5000,
        armour: 10000,
        evasion: 0,
        block_chance: 0,
        spell_suppress: 0,
      },
    })
    const result = await handler(mockBridge, {})
    const text = jsonOf<{ life: number; total_ehp: number }>(result)
    expect(text.life).toBe(5000)
    expect(text.total_ehp).toBe(5000)
  })
})
