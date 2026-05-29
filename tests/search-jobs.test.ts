import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../src/lua-bridge.js'
import { stepLoop, startSearch, getJob, requestCancel, type SearchJob } from '../src/search-jobs.js'

function makeJob(overrides: Partial<SearchJob> = {}): SearchJob {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    status: 'running',
    totalGenerations: 2,
    initial: { score: 100, stats: {} },
    trajectory: [],
    best: null,
    totalEvals: null,
    error: null,
    cancelRequested: false,
    startedAt: Date.now(),
    ...overrides,
  }
}

function stepResp(gen: number, done: boolean, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      done,
      generation: gen,
      best_score: gen * 10,
      avg_score: gen * 5,
      champion_score: gen * 10,
      elapsed_s: gen,
      ...extra,
    },
  }
}

// promise we resolve later, so a parked background step never leaks as a dangling handle
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('stepLoop', () => {
  it('accumulates trajectory and finishes on done', async () => {
    const job = makeJob()
    const send = vi
      .fn()
      .mockResolvedValueOnce(stepResp(1, false))
      .mockResolvedValueOnce(
        stepResp(2, true, {
          best: { score: 20, stats: { FullDPS: 20 }, node_ids: [1, 2], points_used: 5 },
          total_evals: 42,
        }),
      )
    const bridge = { send } as unknown as LuaBridge
    await stepLoop(job, bridge)
    expect(job.status).toBe('done')
    expect(job.trajectory).toHaveLength(2)
    expect(job.best?.score).toBe(20)
    expect(job.totalEvals).toBe(42)
  })

  it('stops on cancel before stepping', async () => {
    const job = makeJob({ cancelRequested: true })
    const send = vi.fn().mockResolvedValue({ ok: true, data: { cancelled: true } })
    const bridge = { send } as unknown as LuaBridge
    await stepLoop(job, bridge)
    expect(job.status).toBe('cancelled')
    expect(send).toHaveBeenCalledWith({ cmd: 'search_cancel' })
    expect(job.trajectory).toHaveLength(0)
  })

  it('marks error if a step rejects', async () => {
    const job = makeJob()
    const send = vi.fn().mockRejectedValueOnce(new Error('LuaJIT exited'))
    const bridge = { send } as unknown as LuaBridge
    await stepLoop(job, bridge)
    expect(job.status).toBe('error')
    expect(job.error).toContain('LuaJIT exited')
  })
})

describe('startSearch', () => {
  it('creates a running job and rejects a concurrent start', async () => {
    const step = deferred<{ ok: boolean; data: unknown }>()
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({ ok: true, data: { initial: { score: 100, stats: {} }, total_generations: 1 } })
      }
      return step.promise // held until the assertions are done, then resolved
    })
    const bridge = { send } as unknown as LuaBridge
    const job = await startSearch(bridge, { objective: { stat: 'FullDPS' } })
    expect(job.status).toBe('running')
    expect(getJob(job.id)).toBe(job)
    await expect(startSearch(bridge, { objective: { stat: 'FullDPS' } })).rejects.toThrow(/already running/)
    expect(requestCancel(job.id)).toBe(true)
    // let the background loop finish so vitest exits cleanly
    step.resolve(stepResp(1, true, { best: { score: 1, stats: {}, node_ids: [], points_used: 1 }, total_evals: 1 }))
    await vi.waitFor(() => expect(job.status).not.toBe('running'))
  })
})
