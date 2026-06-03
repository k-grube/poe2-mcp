import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'

vi.mock('../../src/active-build.js', () => ({
  getBaseline: vi.fn(),
  setActiveBuild: vi.fn(),
}))
vi.mock('../../src/search-jobs.js', () => ({
  getActiveJob: vi.fn(),
}))

import { revertBuild } from '../../src/ops/revert-build.js'
import { getBaseline, setActiveBuild } from '../../src/active-build.js'
import { getActiveJob } from '../../src/search-jobs.js'

const info = { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' }
const bridge = { send: vi.fn().mockResolvedValue({ ok: true, data: info }) } as unknown as LuaBridge

beforeEach(() => {
  vi.mocked(getBaseline).mockReset()
  vi.mocked(setActiveBuild).mockReset()
  vi.mocked(getActiveJob).mockReset()
})

describe('revertBuild', () => {
  it('restores the baseline xml and updates the active build', async () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    vi.mocked(getBaseline).mockReturnValue('<baseline/>')

    const out = await revertBuild(bridge, undefined)

    expect(bridge.send).toHaveBeenCalledWith({ cmd: 'load_build', args: { code: '<baseline/>' } })
    expect(setActiveBuild).toHaveBeenCalledWith(info)
    expect(out).toEqual(info)
  })

  it('errors when no search has run (no baseline)', async () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    vi.mocked(getBaseline).mockReturnValue(null)
    await expect(revertBuild(bridge, undefined)).rejects.toThrow(/nothing to revert/)
  })

  it('rejects while a search is running', async () => {
    vi.mocked(getActiveJob).mockReturnValue({ status: 'running' } as never)
    await expect(revertBuild(bridge, undefined)).rejects.toThrow(/search is running/)
  })
})
