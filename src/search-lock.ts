import { getActiveJob } from './search-jobs.js'
import { getActiveGemJob } from './gem-search-jobs.js'

// one search of either kind at a time (both mutate the single live build state). lives
// above the two job modules so neither imports the other (no cycle).
export function anySearchRunning(): { running: boolean; kind: 'tree' | 'gem' | null } {
  if (getActiveJob()?.status === 'running') {
    return { running: true, kind: 'tree' }
  }
  if (getActiveGemJob()?.status === 'running') {
    return { running: true, kind: 'gem' }
  }
  return { running: false, kind: null }
}
