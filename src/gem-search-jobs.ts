import { randomUUID } from 'node:crypto'
import type { LuaBridge } from './lua-bridge.js'
import type { GemProgressEvent, GemSkillResult, GemEndEvent } from './wire-types.js'
import { gemEvents } from './gem-events.js'

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface GemJob {
  id: string
  status: JobStatus
  groups: number[]
  progress: GemProgressEvent | null
  results: GemSkillResult[]
  error: string | null
  cancelRequested: boolean
  startedAt: number
}

// a single greedy socket-fill step can run ~15s, so give the bridge a long ceiling
const STEP_TIMEOUT_MS = 600_000

interface StartData {
  total_groups: number
  groups: number[]
}
// gem_search_step returns either a progress entry or a terminal { done, results }
type StepData = ({ done: false } & GemProgressEvent) | { done: true; results: GemSkillResult[] }

const jobs = new Map<string, GemJob>()
let activeJob: GemJob | null = null

export function getGemJob(id: string): GemJob | undefined {
  return jobs.get(id)
}

export function getActiveGemJob(): GemJob | null {
  return activeJob
}

export function requestGemCancel(id: string): boolean {
  const job = jobs.get(id)
  if (!job) {
    return false
  }
  job.cancelRequested = true
  return true
}

export type GemStepInput = { type: 'step'; data: StepData } | { type: 'cancel' } | { type: 'error'; message: string }

export interface GemStepTransition {
  patch: Partial<GemJob>
  progressEvent: GemProgressEvent | null
  endEvent: GemEndEvent | null
  done: boolean
}

// pure: decide the job patch + events for one step outcome. no I/O, so unit-testable.
export function computeGemStepTransition(job: GemJob, input: GemStepInput): GemStepTransition {
  if (input.type === 'cancel') {
    return {
      patch: { status: 'cancelled' },
      progressEvent: null,
      endEvent: { job_id: job.id, status: 'cancelled', results: job.results, error: null },
      done: true,
    }
  }
  if (input.type === 'error') {
    return {
      patch: { status: 'error', error: input.message },
      progressEvent: null,
      endEvent: { job_id: job.id, status: 'error', results: job.results, error: input.message },
      done: true,
    }
  }
  const d = input.data
  if (d.done) {
    return {
      patch: { status: 'done', results: d.results, progress: null },
      progressEvent: null,
      endEvent: { job_id: job.id, status: 'done', results: d.results, error: null },
      done: true,
    }
  }
  return { patch: { progress: d, results: d.done_results }, progressEvent: d, endEvent: null, done: false }
}

function applyTransition(job: GemJob, t: GemStepTransition): void {
  Object.assign(job, t.patch)
  if (t.progressEvent) {
    gemEvents.emit('gem:progress', t.progressEvent)
  }
  if (t.endEvent) {
    gemEvents.emit('gem:end', t.endEvent)
  }
}

// drives gem_search_step until done/cancel/error. detached from any request so the search
// survives client disconnect. decision logic lives in computeGemStepTransition.
export async function gemStepLoop(job: GemJob, bridge: LuaBridge): Promise<void> {
  for (;;) {
    if (job.cancelRequested) {
      await bridge.send({ cmd: 'gem_search_cancel' }).catch(() => {})
      applyTransition(job, computeGemStepTransition(job, { type: 'cancel' }))
      return
    }
    let input: GemStepInput
    try {
      const resp = await bridge.send({ cmd: 'gem_search_step', timeoutMs: STEP_TIMEOUT_MS })
      input = { type: 'step', data: resp.data as StepData }
    } catch (e) {
      input = { type: 'error', message: e instanceof Error ? e.message : String(e) }
    }
    const t = computeGemStepTransition(job, input)
    applyTransition(job, t)
    if (t.done) {
      return
    }
  }
}

export async function startGemSearch(bridge: LuaBridge, args: unknown): Promise<GemJob> {
  if (activeJob && activeJob.status === 'running') {
    throw new Error(`a gem search is already running (job ${activeJob.id}); cancel it or wait`)
  }
  const resp = await bridge.send({
    cmd: 'gem_search_start',
    args: (args ?? {}) as Record<string, unknown>,
    timeoutMs: STEP_TIMEOUT_MS,
  })
  const data = resp.data as StartData
  const job: GemJob = {
    id: randomUUID(),
    status: 'running',
    groups: data.groups,
    progress: null,
    results: [],
    error: null,
    cancelRequested: false,
    startedAt: Date.now(),
  }
  jobs.set(job.id, job)
  activeJob = job
  gemEvents.emit('gem:start', { job_id: job.id, total_groups: data.total_groups, groups: data.groups })
  void gemStepLoop(job, bridge)
  return job
}
