import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler } from '../../src/tools/search-result.js'
import { startSearch } from '../../src/search-jobs.js'
import { jsonOf } from '../helpers.js'

describe('search_result tool', () => {
  it('returns the champion once done', async () => {
    const send = vi.fn().mockImplementation((cmd: { cmd: string }) => {
      if (cmd.cmd === 'search_start') {
        return Promise.resolve({
          ok: true,
          data: { initial: { score: 100, stats: { FullDPS: 100 } }, total_generations: 1 },
        })
      }
      return Promise.resolve({
        ok: true,
        data: {
          done: true,
          generation: 1,
          best_score: 500,
          avg_score: 300,
          champion_score: 500,
          elapsed_s: 10,
          best: { score: 500, stats: { FullDPS: 500 }, node_ids: [1, 2, 3], points_used: 100 },
          initial: { score: 100, stats: { FullDPS: 100 } },
          total_evals: 30,
        },
      })
    })
    const bridge = { send } as unknown as LuaBridge
    const job = await startSearch(bridge, { objective: { stat: 'FullDPS' } })
    await vi.waitFor(() => expect(job.status).toBe('done'))
    const result = await handler(bridge, { job_id: job.id })
    const out = jsonOf<{ status: string; best: { score: number; points_used: number }; total_evals: number }>(result)
    expect(out.status).toBe('done')
    expect(out.best.score).toBe(500)
    expect(out.best.points_used).toBe(100)
    expect(out.total_evals).toBe(30)
  })

  it('errors on unknown job_id', async () => {
    const bridge = { send: vi.fn() } as unknown as LuaBridge
    const result = await handler(bridge, { job_id: 'nope' })
    expect(result.isError).toBe(true)
  })
})
