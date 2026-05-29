import type { SearchJob } from './search-jobs.js'
import type { Snapshot } from './wire-types.js'

export type { Snapshot }

// builds the connect-time snapshot so late-join / reconnect replays history then continues live
export function snapshotOf(job: SearchJob | null): Snapshot {
  if (!job) {
    return {
      status: 'idle',
      job_id: null,
      total_generations: 0,
      initial: null,
      trajectory: [],
      champion_node_ids: [],
      error: null,
    }
  }
  const latest = job.trajectory[job.trajectory.length - 1]
  return {
    status: job.status,
    job_id: job.id,
    total_generations: job.totalGenerations,
    initial: job.initial,
    trajectory: job.trajectory,
    champion_node_ids: latest?.champion_node_ids ?? [],
    error: job.error,
  }
}

// SSE wire format: named event + one JSON data line, terminated by a blank line
export function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}
