import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'

vi.mock('../../src/search-jobs.js', () => ({ getActiveJob: vi.fn() }))
vi.mock('../../src/gem-search-jobs.js', () => ({
  getActiveGemJob: vi.fn(),
  startGemSearch: vi.fn(),
  requestGemCancel: vi.fn(),
}))
vi.mock('../../src/active-build.js', () => ({ setBaseline: vi.fn() }))

import { gemSearch } from '../../src/ops/gem-search.js'
import { getActiveJob } from '../../src/search-jobs.js'
import { getActiveGemJob } from '../../src/gem-search-jobs.js'
import { setBaseline } from '../../src/active-build.js'

beforeEach(() => {
  vi.mocked(getActiveJob).mockReset()
  vi.mocked(getActiveGemJob).mockReset()
  vi.mocked(setBaseline).mockReset()
})

const result = {
  results: [{ group: 1, main_skill: 'Ice Shot', supports: [], removed: [], score: 100, score_before: 80 }],
}
const bridge = {
  send: vi
    .fn()
    .mockImplementation((c: { cmd: string }) =>
      c.cmd === 'save_build'
        ? Promise.resolve({ ok: true, data: { xml: '<x/>' } })
        : Promise.resolve({ ok: true, data: result }),
    ),
} as unknown as LuaBridge

describe('gemSearch op', () => {
  it('captures the baseline then runs the gem search', async () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    vi.mocked(getActiveGemJob).mockReturnValue(null)
    const out = await gemSearch(bridge, { objective: { stat: 'FullDPS' } })
    expect(setBaseline).toHaveBeenCalledWith('<x/>')
    expect(bridge.send).toHaveBeenCalledWith({
      cmd: 'gem_search',
      args: { objective: { stat: 'FullDPS' } },
      timeoutMs: 300_000,
    })
    expect(out).toEqual(result)
  })

  it('rejects while a tree search is running', async () => {
    vi.mocked(getActiveJob).mockReturnValue({ status: 'running' } as never)
    vi.mocked(getActiveGemJob).mockReturnValue(null)
    await expect(gemSearch(bridge, {})).rejects.toThrow(/search is running/)
  })

  it('rejects while a gem search is running', async () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    vi.mocked(getActiveGemJob).mockReturnValue({ status: 'running' } as never)
    await expect(gemSearch(bridge, {})).rejects.toThrow(/search is running/)
  })
})
