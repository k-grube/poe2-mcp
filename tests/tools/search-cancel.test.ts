import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler } from '../../src/tools/search-cancel.js'
import { startSearch, getJob } from '../../src/search-jobs.js'
import { jsonOf } from '../helpers.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('search_cancel tool', () => {
  it('requests cancellation of a running job', async () => {
    const gate = deferred<{ ok: boolean; data: unknown }>()
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({ ok: true, data: { initial: { score: 100, stats: {} }, total_generations: 10 } })
      }
      if (cmd.cmd === 'search_cancel') {
        return Promise.resolve({ ok: true, data: { cancelled: true } })
      }
      return gate.promise // keep the loop parked (running) until released
    })
    const bridge = { send } as unknown as LuaBridge
    const job = await startSearch(bridge, { objective: { stat: 'FullDPS' } })
    const result = await handler(bridge, { job_id: job.id })
    const out = jsonOf<{ status: string }>(result)
    expect(out.status).toBe('cancel_requested')
    expect(job.cancelRequested).toBe(true)
    // release the parked step; the loop sees cancelRequested at the top of the next iteration
    gate.resolve({
      ok: true,
      data: { done: false, generation: 1, best_score: 1, avg_score: 1, champion_score: 1, elapsed_s: 1 },
    })
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('cancelled'))
  })

  it('errors on unknown job_id', async () => {
    const bridge = { send: vi.fn() } as unknown as LuaBridge
    const result = await handler(bridge, { job_id: 'nope' })
    expect(result.isError).toBe(true)
  })
})
