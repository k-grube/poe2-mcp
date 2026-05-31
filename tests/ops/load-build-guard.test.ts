import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'

vi.mock('../../src/search-jobs.js', () => ({
  getActiveJob: vi.fn(),
}))

import { loadBuild } from '../../src/ops/load-build.js'
import { getActiveJob } from '../../src/search-jobs.js'

beforeEach(() => {
  vi.mocked(getActiveJob).mockReset()
})

const bridge = { send: vi.fn().mockResolvedValue({ ok: true, data: {} }) } as unknown as LuaBridge

describe('loadBuild concurrency guard', () => {
  it('rejects while a search is running', async () => {
    vi.mocked(getActiveJob).mockReturnValue({ status: 'running' } as never)
    await expect(loadBuild(bridge, { pob_code: '<xml/>' })).rejects.toThrow(/search is running/)
  })

  it('allows load when no search is active', async () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    await expect(loadBuild(bridge, { pob_code: '<xml/>' })).resolves.toBeDefined()
  })
})
