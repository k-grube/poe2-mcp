import { describe, it, expect } from 'vitest'
import { gemSnapshotOf } from '../src/gem-snapshot.js'
import type { GemJob } from '../src/gem-search-jobs.js'

describe('gemSnapshotOf', () => {
  it('is idle with no job', () => {
    expect(gemSnapshotOf(null)).toEqual({
      status: 'idle',
      job_id: null,
      groups: [],
      progress: null,
      results: [],
      error: null,
    })
  })
  it('reflects a running job', () => {
    const job = {
      id: 'j1',
      status: 'running',
      groups: [3],
      progress: null,
      results: [],
      error: null,
      cancelRequested: false,
      startedAt: 0,
    } as GemJob
    expect(gemSnapshotOf(job)).toMatchObject({ status: 'running', job_id: 'j1', groups: [3] })
  })
})
