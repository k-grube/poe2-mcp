import { randomUUID } from 'node:crypto'
import type { LuaBridge } from './lua-bridge.js'
import type { SearchInput } from './tools/search-schema.js'
import type { TrajectoryEntry, SearchBest } from './wire-types.js'
import { searchEvents, type StartEvent, type GenEvent, type EndEvent } from './search-events.js'

export { searchEvents }
export type { StartEvent, GenEvent, EndEvent }
export type { TrajectoryEntry, SearchBest }

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
  searchEvents.emit('start', {
    job_id: job.id,
    total_generations: job.totalGenerations,
    initial: job.initial!,
  })
  void stepLoop(job, bridge)
  return job
}

export type StepInput = { type: 'step'; data: StepData } | { type: 'cancel' } | { type: 'error'; message: string }

export interface StepTransition {
  trajectoryEntry: TrajectoryEntry | null
  patch: Partial<SearchJob>
  genEvent: GenEvent | null
  endEvent: EndEvent | null
  done: boolean
}

// pure: given the current job and one step outcome, decide the trajectory entry to
// push, the job fields to patch, the events to emit, and whether to stop. no I/O,
// so every transition (continue / done / cancelled / error) is unit-testable.
export function computeStepTransition(job: SearchJob, input: StepInput): StepTransition {
  if (input.type === 'cancel') {
    return {
      trajectoryEntry: null,
      patch: { status: 'cancelled' },
      genEvent: null,
      endEvent: { job_id: job.id, status: 'cancelled', best: job.best, total_evals: job.totalEvals, error: null },
      done: true,
    }
  }
  if (input.type === 'error') {
    return {
      trajectoryEntry: null,
      patch: { status: 'error', error: input.message },
      genEvent: null,
      endEvent: { job_id: job.id, status: 'error', best: job.best, total_evals: job.totalEvals, error: input.message },
      done: true,
    }
  }
  const d = input.data
  const entry: TrajectoryEntry = {
    generation: d.generation,
    best_score: d.best_score,
    avg_score: d.avg_score,
    champion_score: d.champion_score,
    elapsed_s: d.elapsed_s,
    champion_node_ids: d.champion_node_ids,
    champion_stats: d.champion_stats,
    points_used: d.points_used,
  }
  const genEvent: GenEvent = { job_id: job.id, status: 'running', ...entry }
  if (d.done) {
    const best = d.best ?? null
    const totalEvals = d.total_evals ?? null
    return {
      trajectoryEntry: entry,
      patch: { status: 'done', best, totalEvals },
      genEvent,
      endEvent: { job_id: job.id, status: 'done', best, total_evals: totalEvals, error: null },
      done: true,
    }
  }
  return { trajectoryEntry: entry, patch: {}, genEvent, endEvent: null, done: false }
}

function applyTransition(job: SearchJob, t: StepTransition): void {
  if (t.trajectoryEntry) {
    job.trajectory.push(t.trajectoryEntry)
  }
  Object.assign(job, t.patch)
  if (t.genEvent) {
    searchEvents.emit('gen', t.genEvent)
  }
  if (t.endEvent) {
    searchEvents.emit('end', t.endEvent)
  }
}

// drives search_step until done/cancel/error, updating the job in place. detached
// from any HTTP request so the search survives client disconnect. the decision
// logic lives in computeStepTransition; this only does I/O and applies the result.
export async function stepLoop(job: SearchJob, bridge: LuaBridge): Promise<void> {
  for (;;) {
    if (job.cancelRequested) {
      await bridge.send({ cmd: 'search_cancel' }).catch(() => {})
      applyTransition(job, computeStepTransition(job, { type: 'cancel' }))
      return
    }
    let input: StepInput
    try {
      const resp = await bridge.send({ cmd: 'search_step', timeoutMs: STEP_TIMEOUT_MS })
      input = { type: 'step', data: resp.data as StepData }
    } catch (e) {
      input = { type: 'error', message: e instanceof Error ? e.message : String(e) }
    }
    const t = computeStepTransition(job, input)
    applyTransition(job, t)
    if (t.done) {
      return
    }
  }
}

export function getActiveJob(): SearchJob | null {
  return activeJob
}
