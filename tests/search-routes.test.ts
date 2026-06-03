import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request } from 'express'
import type { LuaBridge } from '../src/lua-bridge.js'

vi.mock('../src/search-jobs.js', () => ({
  startSearch: vi.fn(),
  requestCancel: vi.fn(),
  getActiveJob: vi.fn(),
}))

import { httpRoute } from '../src/http-route.js'
import { searchStart, searchCancel } from '../src/ops/search.js'
import { startSearch, requestCancel, getActiveJob } from '../src/search-jobs.js'

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
}

const bridge = { send: vi.fn().mockResolvedValue({ ok: true, data: { xml: '<x/>' } }) } as unknown as LuaBridge

beforeEach(() => {
  vi.mocked(startSearch).mockReset()
  vi.mocked(requestCancel).mockReset()
  vi.mocked(getActiveJob).mockReset()
  vi.mocked(getActiveJob).mockReturnValue(null)
})

describe('POST /api/search', () => {
  it('200s with a job summary', async () => {
    vi.mocked(startSearch).mockResolvedValue({
      id: 'j1',
      status: 'running',
      totalGenerations: 5,
      initial: { score: 902000, stats: {} },
    } as never)
    const handler = httpRoute(bridge, searchStart, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { objective: { stat: 'FullDPS' } } } as Request, res as never)
    expect(res.statusCode).toBe(200)
    expect((res.body as { job_id: string }).job_id).toBe('j1')
    expect((res.body as { initial_score: number }).initial_score).toBe(902000)
  })

  it('409s when a search is already running', async () => {
    vi.mocked(startSearch).mockRejectedValue(new Error('a search is already running'))
    const handler = httpRoute(bridge, searchStart, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { objective: { stat: 'FullDPS' } } } as Request, res as never)
    expect(res.statusCode).toBe(409)
  })
})

describe('POST /api/search/cancel', () => {
  it('200s when the job exists', async () => {
    vi.mocked(requestCancel).mockReturnValue(true)
    const handler = httpRoute(bridge, searchCancel, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { job_id: 'j1' } } as Request, res as never)
    expect(res.statusCode).toBe(200)
    expect((res.body as { status: string }).status).toBe('cancel_requested')
  })

  it('409s on an unknown job_id', async () => {
    vi.mocked(requestCancel).mockReturnValue(false)
    const handler = httpRoute(bridge, searchCancel, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { job_id: 'nope' } } as Request, res as never)
    expect(res.statusCode).toBe(409)
  })
})
