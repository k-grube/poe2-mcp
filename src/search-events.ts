import { EventEmitter } from 'node:events'
import type { SearchBest } from './search-jobs.js'

export interface StartEvent {
  job_id: string
  total_generations: number
  initial: { score: number; stats: Record<string, number> }
}

export interface GenEvent {
  job_id: string
  generation: number
  status: 'running'
  best_score: number
  avg_score: number
  champion_score: number
  elapsed_s: number
  champion_node_ids: number[]
  champion_stats: Record<string, number>
  points_used: number
}

export interface EndEvent {
  job_id: string
  status: 'done' | 'cancelled' | 'error'
  best: SearchBest | null
  total_evals: number | null
  error: string | null
}

interface SearchEventMap {
  start: [StartEvent]
  gen: [GenEvent]
  end: [EndEvent]
}

// single process-wide bus; SSE routes subscribe, stepLoop publishes
export const searchEvents = new EventEmitter<SearchEventMap>()
