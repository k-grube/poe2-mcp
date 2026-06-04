import { useEffect, useReducer } from 'react'
import type { GemSnapshot, GemStartEvent, GemProgressEvent, GemEndEvent, GemSkillResult, Status } from './types.js'

export interface GemStreamState {
  status: Status
  jobId: string | null
  groups: number[]
  progress: GemProgressEvent | null
  results: GemSkillResult[]
  error: string | null
}

export const gemInitialState: GemStreamState = {
  status: 'idle',
  jobId: null,
  groups: [],
  progress: null,
  results: [],
  error: null,
}

type GemAction =
  | { type: 'snapshot'; e: GemSnapshot }
  | { type: 'start'; e: GemStartEvent }
  | { type: 'progress'; e: GemProgressEvent }
  | { type: 'end'; e: GemEndEvent }

export function reduceGem(state: GemStreamState, action: GemAction): GemStreamState {
  switch (action.type) {
    case 'snapshot': {
      const { e } = action
      return {
        status: e.status,
        jobId: e.job_id,
        groups: e.groups,
        progress: e.progress,
        results: e.results,
        error: e.error,
      }
    }
    case 'start': {
      const { e } = action
      return { ...gemInitialState, status: 'running', jobId: e.job_id, groups: e.groups }
    }
    case 'progress': {
      const { e } = action
      return { ...state, status: 'running', progress: e, results: e.done_results }
    }
    case 'end': {
      const { e } = action
      return { ...state, status: e.status, progress: null, results: e.results, error: e.error }
    }
    default:
      return state
  }
}

// shares the same /events EventSource semantics as useSearchStream, gem:* events
export function useGemSearchStream(): GemStreamState {
  const [state, dispatch] = useReducer(reduceGem, gemInitialState)
  useEffect(() => {
    const es = new EventSource('/events')
    es.addEventListener('gem:snapshot', (ev) =>
      dispatch({ type: 'snapshot', e: JSON.parse((ev as MessageEvent).data) }),
    )
    es.addEventListener('gem:start', (ev) => dispatch({ type: 'start', e: JSON.parse((ev as MessageEvent).data) }))
    es.addEventListener('gem:progress', (ev) =>
      dispatch({ type: 'progress', e: JSON.parse((ev as MessageEvent).data) }),
    )
    es.addEventListener('gem:end', (ev) => dispatch({ type: 'end', e: JSON.parse((ev as MessageEvent).data) }))
    return () => es.close()
  }, [])
  return state
}
