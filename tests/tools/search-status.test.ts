import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler } from '../../src/tools/search-status.js'
import { startSearch, getJob } from '../../src/search-jobs.js'
import { jsonOf } from '../helpers.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('search_status tool', () => {
  it('reports running status with latest generation', async () => {
    const gate = deferred<{ ok: boolean; data: unknown }>()
    let stepCalls = 0
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({ ok: true, data: { initial: { score: 100, stats: {} }, total_generations: 4 } })
      }
      stepCalls++
      if (stepCalls === 1) {
        return Promise.resolve({
          ok: true,
          data: { done: false, generation: 1, best_score: 150, avg_score: 120, champion_score: 150, elapsed_s: 3 },
        })
      }
      return gate.promise // hold at generation 1 so status stays running
    })
    const bridge = { send } as unknown as LuaBridge
    const job = await startSearch(bridge, { objective: { stat: 'FullDPS' } })
    await vi.waitFor(() => expect(job.trajectory.length).toBe(1))
    const result = await handler(bridge, { job_id: job.id })
    const out = jsonOf<{ status: string; generation: number; champion_score: number }>(result)
    expect(out.status).toBe('running')
    expect(out.generation).toBe(1)
    expect(out.champion_score).toBe(150)
    // release the parked step so the loop ends cleanly
    gate.resolve({
      ok: true,
      data: {
        done: true,
        generation: 2,
        best_score: 150,
        avg_score: 120,
        champion_score: 150,
        elapsed_s: 4,
        best: { score: 150, stats: {}, node_ids: [], points_used: 1 },
        total_evals: 1,
      },
    })
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('done'))
  })

  it('errors on unknown job_id', async () => {
    const bridge = { send: vi.fn() } as unknown as LuaBridge
    const result = await handler(bridge, { job_id: 'nope' })
    expect(result.isError).toBe(true)
  })
})
