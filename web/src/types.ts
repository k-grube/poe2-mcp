export type NodeType =
  | 'keystone'
  | 'notable'
  | 'mastery'
  | 'jewel_socket'
  | 'class_start'
  | 'ascend_start'
  | 'ascendancy'
  | 'normal'

export interface TreeNode {
  id: number
  type: NodeType
  x: number
  y: number
  name: string
  ascendancy?: string
  stats?: string[]
}

export interface TreeLayout {
  nodes: TreeNode[]
  edges: [number, number][]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

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

export type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface Snapshot {
  status: Status
  job_id: string | null
  total_generations: number
  initial: { score: number; stats: Record<string, number> } | null
  trajectory: TrajectoryEntry[]
  champion_node_ids: number[]
  error: string | null
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
  best: { score: number; stats: Record<string, number>; node_ids: number[]; points_used: number } | null
  total_evals: number | null
  error: string | null
}
