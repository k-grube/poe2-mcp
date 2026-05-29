// the over-the-wire contract shared by the server (events + sse) and the browser
// viz. pure types -> erased at build, so the web imports these directly with no
// second copy to keep in sync.

export type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface TrajectoryEntry {
  generation: number
  best_score: number
  avg_score: number
  champion_score: number
  elapsed_s: number
  champion_node_ids: number[]
  champion_stats: Record<string, number>
  points_used: number
}

export interface SearchBest {
  score: number
  stats: Record<string, number>
  node_ids: number[]
  points_used: number
}

export interface StartEvent {
  job_id: string
  total_generations: number
  initial: { score: number; stats: Record<string, number> }
}

export interface GenEvent extends TrajectoryEntry {
  job_id: string
  status: 'running'
}

export interface EndEvent {
  job_id: string
  status: 'done' | 'cancelled' | 'error'
  best: SearchBest | null
  total_evals: number | null
  error: string | null
}

export interface Snapshot {
  status: Status
  job_id: string | null
  total_generations: number
  initial: { score: number; stats: Record<string, number> } | null
  trajectory: TrajectoryEntry[]
  champion_node_ids: number[]
  error: string | null
}
