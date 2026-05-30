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
  build: BuildInfo | null
}

export interface BuildInfo {
  class_name: string
  ascendancy: string
  level: number
  main_skill: string
}

export interface Gem {
  name: string
  support: boolean
  enabled: boolean
  level: number | null
  quality: number | null
}

export interface SocketGroup {
  index: number
  label: string | null
  enabled: boolean
  include_in_full_dps: boolean
  is_main: boolean
  slot: string | null
  source: string | null
  main_skill_name: string | null
  gem_count: number
  gems: Gem[]
}

export interface BuildSummary {
  info: BuildInfo
  dps: Record<string, unknown>
  ehp: Record<string, unknown>
  breakpoints: Record<string, unknown>
  tree: { points_used: number; keystones: string[]; notables: string[] }
  socket_groups: { groups: SocketGroup[]; main_socket_group: number }
  // alloc_mode: 0 normal, 1 weapon set 1, 2 weapon set 2
  allocated_nodes: Array<{ id: number; alloc_mode: number }>
}
