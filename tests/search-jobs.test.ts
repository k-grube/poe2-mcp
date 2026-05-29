import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../src/lua-bridge.js'
import {
  stepLoop,
  startSearch,
  getJob,
  requestCancel,
  searchEvents,
  type SearchJob,
  type StartEvent,
  type GenEvent,
  type EndEvent,
} from '../src/search-jobs.js'

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
      champion_node_ids: [gen],
      champion_stats: { FullDPS: gen * 10 },
      points_used: 100 + gen,
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

describe('search events', () => {
  it('emits start -> gen* -> end with champion payloads', async () => {
    const events: Array<['start', StartEvent] | ['gen', GenEvent] | ['end', EndEvent]> = []
    const onStart = (e: StartEvent) => events.push(['start', e])
    const onGen = (e: GenEvent) => events.push(['gen', e])
    const onEnd = (e: EndEvent) => events.push(['end', e])
    searchEvents.on('start', onStart)
    searchEvents.on('gen', onGen)
    searchEvents.on('end', onEnd)

    const champ = (gen: number, done: boolean) => ({
      ok: true,
      data: {
        done,
        generation: gen,
        best_score: gen * 10,
        avg_score: gen * 5,
        champion_score: gen * 10,
        elapsed_s: gen,
        champion_node_ids: [1, 2, gen],
        champion_stats: { FullDPS: gen * 10 },
        points_used: 100 + gen,
        ...(done
          ? { best: { score: 20, stats: { FullDPS: 20 }, node_ids: [1, 2], points_used: 102 }, total_evals: 9 }
          : {}),
      },
    })
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({
          ok: true,
          data: { initial: { score: 5, stats: { FullDPS: 5 } }, total_generations: 2 },
        })
      }
      return send.mock.calls.filter((c) => c[0].cmd === 'search_step').length === 1 ? champ(1, false) : champ(2, true)
    })
    const bridge = { send } as unknown as LuaBridge
    const job = await startSearch(bridge, { objective: { stat: 'FullDPS' } })
    await vi.waitFor(() => expect(job.status).toBe('done'))

    expect(events.map((e) => e[0])).toEqual(['start', 'gen', 'gen', 'end'])
    const gen1 = events.find((e) => e[0] === 'gen')![1] as GenEvent
    expect(gen1.champion_node_ids).toEqual([1, 2, 1])
    expect(gen1.champion_stats.FullDPS).toBe(10)
    expect(gen1.points_used).toBe(101)
    const end = events.find((e) => e[0] === 'end')![1] as EndEvent
    expect(end.status).toBe('done')
    expect(end.best?.score).toBe(20)

    searchEvents.off('start', onStart)
    searchEvents.off('gen', onGen)
    searchEvents.off('end', onEnd)
  })
})
