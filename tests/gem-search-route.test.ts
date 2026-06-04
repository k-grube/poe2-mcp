import { describe, it, expect, vi } from 'vitest'
import type { Request } from 'express'
import type { LuaBridge } from '../src/lua-bridge.js'

vi.mock('../src/search-jobs.js', () => ({ getActiveJob: vi.fn().mockReturnValue(null) }))
vi.mock('../src/active-build.js', () => ({ setBaseline: vi.fn() }))

import { httpRoute } from '../src/http-route.js'
import { gemSearch } from '../src/ops/gem-search.js'

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(c: number) {
      this.statusCode = c
      return this
    },
    json(p: unknown) {
      this.body = p
      return this
    },
  }
}

const bridge = {
  send: vi
    .fn()
    .mockImplementation((c: { cmd: string }) =>
      c.cmd === 'save_build'
        ? Promise.resolve({ ok: true, data: { xml: '<x/>' } })
        : Promise.resolve({ ok: true, data: { results: [] } }),
    ),
} as unknown as LuaBridge

describe('POST /api/gem-search', () => {
  it('200s with the gem result', async () => {
    const handler = httpRoute(bridge, gemSearch, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { objective: { stat: 'FullDPS' } } } as Request, res as never)
    expect(res.statusCode).toBe(200)
    expect((res.body as { results: unknown[] }).results).toEqual([])
  })
})
