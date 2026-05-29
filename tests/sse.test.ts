import { describe, it, expect } from 'vitest'
import { snapshotOf, sseLine } from '../src/sse.js'
import type { SearchJob } from '../src/search-jobs.js'

function job(overrides: Partial<SearchJob> = {}): SearchJob {
  return {
    id: 'j1',
    status: 'running',
    totalGenerations: 4,
    initial: { score: 100, stats: { FullDPS: 100 } },
    trajectory: [
      {
        generation: 1,
        best_score: 150,
        avg_score: 120,
        champion_score: 150,
        elapsed_s: 3,
        champion_node_ids: [1, 2, 3],
        champion_stats: { FullDPS: 150 },
        points_used: 101,
      },
    ],
    best: null,
    totalEvals: null,
    error: null,
    cancelRequested: false,
    startedAt: 0,
    ...overrides,
  }
}

describe('snapshotOf', () => {
  it('summarizes an active job for late-joiners', () => {
    const s = snapshotOf(job())
    expect(s.status).toBe('running')
    expect(s.total_generations).toBe(4)
    expect(s.trajectory).toHaveLength(1)
    expect(s.champion_node_ids).toEqual([1, 2, 3])
    expect(s.initial?.score).toBe(100)
  })

  it('returns idle when no job', () => {
    const s = snapshotOf(null)
    expect(s.status).toBe('idle')
    expect(s.trajectory).toEqual([])
    expect(s.champion_node_ids).toEqual([])
  })
})

describe('sseLine', () => {
  it('formats a named SSE event with JSON data', () => {
    expect(sseLine('gen', { a: 1 })).toBe('event: gen\ndata: {"a":1}\n\n')
  })
})
