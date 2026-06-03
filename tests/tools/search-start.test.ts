import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/search-start.js'
import { getJob } from '../../src/search-jobs.js'
import { jsonOf } from '../helpers.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('search_start tool', () => {
  it('definition requires objective', () => {
    expect(definition.name).toBe('search_start')
    expect(definition.inputSchema.required ?? []).toContain('objective')
  })

  it('returns a job_id and initial score', async () => {
    // gate the step so the background loop is still running when the handler serializes
    const gate = deferred<{ ok: boolean; data: unknown }>()
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'save_build') {
        return Promise.resolve({ ok: true, data: { xml: '<x/>' } })
      }
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({ ok: true, data: { initial: { score: 902000, stats: {} }, total_generations: 5 } })
      }
      return gate.promise
    })
    const bridge = { send } as unknown as LuaBridge
    const result = await handler(bridge, { objective: { stat: 'FullDPS' }, generations: 5 })
    const out = jsonOf<{ job_id: string; status: string; total_generations: number; initial_score: number }>(result)
    expect(out.job_id).toBeTruthy()
    expect(out.status).toBe('running')
    expect(out.total_generations).toBe(5)
    expect(out.initial_score).toBe(902000)
    // release the parked step so the loop finishes and vitest exits cleanly
    gate.resolve({
      ok: true,
      data: {
        done: true,
        generation: 1,
        best_score: 1,
        avg_score: 1,
        champion_score: 1,
        elapsed_s: 0,
        best: { score: 1, stats: {}, node_ids: [], points_used: 1 },
        total_evals: 1,
      },
    })
    await vi.waitFor(() => expect(getJob(out.job_id)?.status).toBe('done'))
  })

  it('errors on invalid objective', async () => {
    const bridge = { send: vi.fn() } as unknown as LuaBridge
    const result = await handler(bridge, { objective: {} })
    expect(result.isError).toBe(true)
  })
})
