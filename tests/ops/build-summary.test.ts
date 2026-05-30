import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { getBuildSummary } from '../../src/ops/build-summary.js'

function bridgeReturning(byCmd: Record<string, unknown>): LuaBridge {
  const send = vi.fn(async ({ cmd }: { cmd: string }) => {
    if (!(cmd in byCmd)) {
      throw new Error(`no build loaded`)
    }
    return { ok: true, data: byCmd[cmd] }
  })
  return { send } as unknown as LuaBridge
}

describe('getBuildSummary', () => {
  it('aggregates the per-area handlers into one object', async () => {
    const bridge = bridgeReturning({
      get_build_info: { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' },
      get_dps: { full_dps: 123 },
      get_ehp: { total_ehp: 456 },
      get_breakpoints: { fire_res: 75 },
      get_tree_summary: { points_used: 100, keystones: ['Chaos Inoculation'], notables: [] },
      get_socket_groups: { groups: [], main_socket_group: 1 },
    })
    const out = (await getBuildSummary(bridge, undefined)) as {
      info: { class_name: string }
      dps: { full_dps: number }
    }
    expect(out.info.class_name).toBe('Witch')
    expect(out.dps.full_dps).toBe(123)
  })

  it('propagates a no-build error from the first call', async () => {
    const bridge = bridgeReturning({})
    await expect(getBuildSummary(bridge, undefined)).rejects.toThrow('no build loaded')
  })
})
