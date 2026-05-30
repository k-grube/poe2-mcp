import { describe, it, expect } from 'vitest'
import { reduce, initialState, type StreamState } from './useSearchStream.js'
import type { Snapshot, StartEvent, GenEvent, EndEvent, BuildInfo } from './types.js'

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  status: 'running',
  job_id: 'j1',
  total_generations: 4,
  initial: { score: 100, stats: { FullDPS: 100 } },
  trajectory: [],
  champion_node_ids: [],
  error: null,
  build: null,
  ...over,
})

const gen = (g: number, ids: number[]): GenEvent => ({
  job_id: 'j1',
  status: 'running',
  generation: g,
  best_score: g * 10,
  avg_score: g * 5,
  champion_score: g * 10,
  elapsed_s: g,
  champion_node_ids: ids,
  champion_stats: { FullDPS: g * 10 },
  points_used: 100 + g,
})

describe('useSearchStream reducer', () => {
  it('start resets state and stores baseline', () => {
    const s0 = reduce(initialState, {
      type: 'start',
      e: { job_id: 'j1', total_generations: 4, initial: { score: 100, stats: { FullDPS: 100 } } } as StartEvent,
    })
    expect(s0.status).toBe('running')
    expect(s0.totalGenerations).toBe(4)
    expect(s0.initial?.score).toBe(100)
    expect(s0.championNodeIds.size).toBe(0)
    expect(s0.scoreHistory).toEqual([])
  })

  it('gen appends history, replaces champion set, keeps previous for diff', () => {
    let s: StreamState = reduce(initialState, { type: 'snapshot', e: snap() })
    s = reduce(s, { type: 'gen', e: gen(1, [1, 2, 3]) })
    s = reduce(s, { type: 'gen', e: gen(2, [2, 3, 4]) })
    expect(s.scoreHistory).toHaveLength(2)
    expect([...s.championNodeIds].sort()).toEqual([2, 3, 4])
    expect([...s.prevNodeIds].sort()).toEqual([1, 2, 3])
    expect(s.generation).toBe(2)
  })

  it('snapshot rebuilds idempotently (reconnect-safe)', () => {
    const s = reduce(initialState, {
      type: 'snapshot',
      e: snap({ trajectory: [gen(1, [1, 2]), gen(2, [3, 4])], champion_node_ids: [3, 4] }),
    })
    expect(s.scoreHistory).toHaveLength(2)
    expect([...s.championNodeIds].sort()).toEqual([3, 4])
    // applying the same snapshot again must not duplicate history
    const s2 = reduce(s, {
      type: 'snapshot',
      e: snap({ trajectory: [gen(1, [1, 2]), gen(2, [3, 4])], champion_node_ids: [3, 4] }),
    })
    expect(s2.scoreHistory).toHaveLength(2)
  })

  it('end sets terminal status', () => {
    let s = reduce(initialState, { type: 'snapshot', e: snap() })
    s = reduce(s, {
      type: 'end',
      e: { job_id: 'j1', status: 'done', best: null, total_evals: 9, error: null } as EndEvent,
    })
    expect(s.status).toBe('done')
  })

  it('build action sets buildInfo and clears stale search state', () => {
    const info: BuildInfo = { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' }
    let s = reduce(initialState, {
      type: 'snapshot',
      e: snap({ trajectory: [gen(1, [1, 2])], champion_node_ids: [1, 2] }),
    })
    s = reduce(s, { type: 'build', e: info })
    expect(s.buildInfo).toEqual(info)
    expect(s.scoreHistory).toEqual([])
    expect(s.championNodeIds.size).toBe(0)
  })

  it('snapshot carries buildInfo from the wire', () => {
    const info: BuildInfo = { class_name: 'Ranger', ascendancy: 'Pathfinder', level: 99, main_skill: 'Ghost Dance' }
    const s = reduce(initialState, { type: 'snapshot', e: snap({ build: info }) })
    expect(s.buildInfo).toEqual(info)
  })
})
