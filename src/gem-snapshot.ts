import type { GemJob } from './gem-search-jobs.js'
import type { GemSnapshot } from './wire-types.js'

// connect-time snapshot so a late-join replays current state then continues live
export function gemSnapshotOf(job: GemJob | null): GemSnapshot {
  if (!job) {
    return { status: 'idle', job_id: null, groups: [], progress: null, results: [], error: null }
  }
  return {
    status: job.status,
    job_id: job.id,
    groups: job.groups,
    progress: job.progress,
    results: job.results,
    error: job.error,
  }
}
