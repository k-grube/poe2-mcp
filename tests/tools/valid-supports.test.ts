import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/valid-supports.js'
import { jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

beforeEach(() => {
  vi.mocked(mockBridge.send).mockReset()
})

describe('get_valid_supports tool', () => {
  it('is named and documented', () => {
    expect(definition.name).toBe('get_valid_supports')
    expect((definition.description ?? '').length).toBeGreaterThan(20)
  })

  it('forwards group + as_imported and returns the bridge data', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { group: 2, supports: [{ id: 'X', name: 'Added Cold Damage', lineage: false, family: null }] },
    })
    const result = await handler(mockBridge, { group: 2, as_imported: true })
    expect(mockBridge.send).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'get_valid_supports', args: { group: 2, as_imported: true } }),
    )
    const data = jsonOf<{ group: number; supports: Array<{ id: string }> }>(result)
    expect(data.group).toBe(2)
    expect(data.supports[0].id).toBe('X')
  })

  it('sends empty args (main group, idealized) when none given', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({ ok: true, data: { group: 1, supports: [] } })
    await handler(mockBridge, {})
    expect(mockBridge.send).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'get_valid_supports', args: {} }))
  })
})
