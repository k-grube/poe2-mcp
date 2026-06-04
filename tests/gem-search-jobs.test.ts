import { describe, it, expect } from 'vitest'
import { computeGemStepTransition, type GemJob } from '../src/gem-search-jobs.js'
import type { GemProgressEvent, GemSkillResult } from '../src/wire-types.js'

function job(): GemJob {
  return {
    id: 'j1',
    status: 'running',
    groups: [3],
    progress: null,
    results: [],
    error: null,
    cancelRequested: false,
    startedAt: 0,
  }
}

const prog: GemProgressEvent = {
  job_id: 'j1',
  status: 'running',
  group: 3,
  main_skill: 'Ice Shot',
  phase: 'greedy',
  step: 1,
  total_steps: 5,
  best_score: 300,
  score_before: 235,
  current_supports: [{ id: 'A', name: 'Fork' }],
  done_results: [],
  group_ordinal: 1,
  total_groups: 1,
}

describe('computeGemStepTransition', () => {
  it('continues on a running step', () => {
    const t = computeGemStepTransition(job(), { type: 'step', data: { done: false, ...prog } })
    expect(t.done).toBe(false)
    expect(t.patch.progress).toMatchObject({ best_score: 300 })
    expect(t.progressEvent?.best_score).toBe(300)
    expect(t.endEvent).toBeNull()
  })

  it('finishes with results on done', () => {
    const results: GemSkillResult[] = [
      { group: 3, main_skill: 'Ice Shot', supports: [], removed: [], score: 360, score_before: 235 },
    ]
    const t = computeGemStepTransition(job(), { type: 'step', data: { done: true, results } })
    expect(t.done).toBe(true)
    expect(t.patch.status).toBe('done')
    expect(t.patch.results).toEqual(results)
    expect(t.endEvent).toMatchObject({ status: 'done', results })
  })

  it('cancels', () => {
    const t = computeGemStepTransition(job(), { type: 'cancel' })
    expect(t.done).toBe(true)
    expect(t.patch.status).toBe('cancelled')
    expect(t.endEvent?.status).toBe('cancelled')
  })

  it('errors', () => {
    const t = computeGemStepTransition(job(), { type: 'error', message: 'boom' })
    expect(t.done).toBe(true)
    expect(t.patch.status).toBe('error')
    expect(t.endEvent).toMatchObject({ status: 'error', error: 'boom' })
  })
})
