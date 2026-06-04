import { describe, it, expect } from 'vitest'
import { reduceGem, gemInitialState } from './useGemSearchStream.js'
import type { GemProgressEvent, GemSkillResult } from './types.js'

const result: GemSkillResult = {
  group: 3,
  main_skill: 'Ice Shot',
  supports: [{ id: 'A', name: 'Elemental Focus', kept: false }],
  removed: [{ id: 'B', name: 'Fork' }],
  score: 360,
  score_before: 235,
}
const progress: GemProgressEvent = {
  job_id: 'j1',
  status: 'running',
  group: 3,
  main_skill: 'Ice Shot',
  phase: 'greedy',
  step: 2,
  total_steps: 5,
  best_score: 300,
  score_before: 235,
  current_supports: [{ id: 'A', name: 'Elemental Focus' }],
  done_results: [],
  group_ordinal: 1,
  total_groups: 1,
}

describe('reduceGem', () => {
  it('starts running', () => {
    const s = reduceGem(gemInitialState, { type: 'start', e: { job_id: 'j1', total_groups: 1, groups: [3] } })
    expect(s.status).toBe('running')
    expect(s.jobId).toBe('j1')
  })
  it('tracks progress', () => {
    const s = reduceGem(gemInitialState, { type: 'progress', e: progress })
    expect(s.progress?.best_score).toBe(300)
  })
  it('captures results on end', () => {
    const s = reduceGem(gemInitialState, {
      type: 'end',
      e: { job_id: 'j1', status: 'done', results: [result], error: null },
    })
    expect(s.status).toBe('done')
    expect(s.results[0].removed[0].name).toBe('Fork')
  })
})
