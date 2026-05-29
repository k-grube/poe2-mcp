import { randomUUID } from 'node:crypto'
import type { LuaBridge } from './lua-bridge.js'
import type { SearchInput } from './tools/search-schema.js'

export interface TrajectoryEntry {
  generation: number
  best_score: number
  avg_score: number
  champion_score: number
  elapsed_s: number
}

export interface SearchBest {
  score: number
  stats: Record<string, number>
  node_ids: number[]
  points_used: number
}

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface SearchJob {
  id: string
  status: JobStatus
  totalGenerations: number
  initial: { score: number; stats: Record<string, number> } | null
  trajectory: TrajectoryEntry[]
  best: SearchBest | null
  totalEvals: number | null
  error: string | null
  cancelRequested: boolean
  startedAt: number
}

interface StartData {
  initial: { score: number; stats: Record<string, number> }
  total_generations: number
}

interface StepData extends TrajectoryEntry {
  done: boolean
  best?: SearchBest
  total_evals?: number
}

// one Lua build state -> one active search at a time
const jobs = new Map<string, SearchJob>()
let activeJob: SearchJob | null = null

// a per-generation Lua step can run tens of seconds on large populations
const STEP_TIMEOUT_MS = 600_000

export function getJob(id: string): SearchJob | undefined {
  return jobs.get(id)
}

export function requestCancel(id: string): boolean {
  const job = jobs.get(id)
  if (!job) {
    return false
  }
  job.cancelRequested = true
  return true
}

export async function startSearch(bridge: LuaBridge, args: SearchInput): Promise<SearchJob> {
  if (activeJob && activeJob.status === 'running') {
    throw new Error(`a search is already running (job ${activeJob.id}); cancel it or wait`)
  }
  const resp = await bridge.send({ cmd: 'search_start', args, timeoutMs: STEP_TIMEOUT_MS })
  const data = resp.data as StartData
  const job: SearchJob = {
    id: randomUUID(),
    status: 'running',
    totalGenerations: data.total_generations,
    initial: data.initial,
    trajectory: [],
    best: null,
    totalEvals: null,
    error: null,
    cancelRequested: false,
    startedAt: Date.now(),
  }
  jobs.set(job.id, job)
  activeJob = job
  void stepLoop(job, bridge)
  return job
}

// drives search_step until done/cancel/error, updating the job in place.
// detached from any HTTP request so the search survives client disconnect.
export async function stepLoop(job: SearchJob, bridge: LuaBridge): Promise<void> {
  try {
    for (;;) {
      if (job.cancelRequested) {
        await bridge.send({ cmd: 'search_cancel' }).catch(() => {})
        job.status = 'cancelled'
        return
      }
      const resp = await bridge.send({ cmd: 'search_step', timeoutMs: STEP_TIMEOUT_MS })
      const d = resp.data as StepData
      job.trajectory.push({
        generation: d.generation,
        best_score: d.best_score,
        avg_score: d.avg_score,
        champion_score: d.champion_score,
        elapsed_s: d.elapsed_s,
      })
      if (d.done) {
        job.best = d.best ?? null
        job.totalEvals = d.total_evals ?? null
        job.status = 'done'
        return
      }
    }
  } catch (e) {
    job.status = 'error'
    job.error = e instanceof Error ? e.message : String(e)
  }
}
