import { useEffect, useReducer } from 'react'
import { sharedEvents } from './eventStream.js'
import type { Snapshot, StartEvent, GenEvent, EndEvent, Status, TrajectoryEntry, BuildInfo } from './types.js'

export interface ScorePoint {
  generation: number
  best: number
  avg: number
  champion: number
  elapsed: number
}

export interface StreamState {
  status: Status
  jobId: string | null
  generation: number
  totalGenerations: number
  scoreHistory: ScorePoint[]
  championNodeIds: Set<number>
  championModes: Map<number, number>
  prevNodeIds: Set<number>
  championStats: Record<string, number>
  initial: { score: number; stats: Record<string, number> } | null
  pointsUsed: number
  error: string | null
  buildInfo: BuildInfo | null
}

export const initialState: StreamState = {
  status: 'idle',
  jobId: null,
  generation: 0,
  totalGenerations: 0,
  scoreHistory: [],
  championNodeIds: new Set(),
  championModes: new Map(),
  prevNodeIds: new Set(),
  championStats: {},
  initial: null,
  pointsUsed: 0,
  error: null,
  buildInfo: null,
}

type Action =
  | { type: 'snapshot'; e: Snapshot }
  | { type: 'start'; e: StartEvent }
  | { type: 'gen'; e: GenEvent }
  | { type: 'end'; e: EndEvent }
  | { type: 'build'; e: BuildInfo }

const point = (t: TrajectoryEntry): ScorePoint => ({
  generation: t.generation,
  best: t.best_score,
  avg: t.avg_score,
  champion: t.champion_score,
  elapsed: t.elapsed_s,
})

const modeMap = (modes: { id: number; mode: number }[]): Map<number, number> =>
  new Map(modes.map((m) => [m.id, m.mode]))

export function reduce(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case 'snapshot': {
      const { e } = action
      const last = e.trajectory[e.trajectory.length - 1]
      return {
        ...initialState,
        status: e.status,
        jobId: e.job_id,
        totalGenerations: e.total_generations,
        initial: e.initial,
        scoreHistory: e.trajectory.map(point),
        championNodeIds: new Set(e.champion_node_ids),
        championModes: modeMap(e.champion_node_modes ?? []),
        prevNodeIds: new Set(),
        championStats: last?.champion_stats ?? {},
        generation: last?.generation ?? 0,
        pointsUsed: last?.points_used ?? 0,
        error: e.error,
        buildInfo: e.build,
      }
    }
    case 'start': {
      const { e } = action
      return {
        ...initialState,
        status: 'running',
        jobId: e.job_id,
        totalGenerations: e.total_generations,
        initial: e.initial,
        buildInfo: state.buildInfo,
      }
    }
    case 'gen': {
      const { e } = action
      return {
        ...state,
        status: 'running',
        generation: e.generation,
        scoreHistory: [...state.scoreHistory, point(e)],
        prevNodeIds: state.championNodeIds,
        championNodeIds: new Set(e.champion_node_ids),
        championModes: modeMap(e.champion_node_modes ?? []),
        championStats: e.champion_stats,
        pointsUsed: e.points_used,
      }
    }
    case 'end': {
      const { e } = action
      return { ...state, status: e.status, error: e.error }
    }
    case 'build': {
      return { ...initialState, buildInfo: action.e }
    }
    default:
      return state
  }
}

// opens EventSource('/events'), reduces start|snapshot|gen|end; auto-reconnect is EventSource's
export function useSearchStream(): StreamState {
  const [state, dispatch] = useReducer(reduce, initialState)
  useEffect(() => {
    const es = sharedEvents()
    const onSnapshot = (ev: Event) => dispatch({ type: 'snapshot', e: JSON.parse((ev as MessageEvent).data) })
    const onStart = (ev: Event) => dispatch({ type: 'start', e: JSON.parse((ev as MessageEvent).data) })
    const onGen = (ev: Event) => dispatch({ type: 'gen', e: JSON.parse((ev as MessageEvent).data) })
    const onEnd = (ev: Event) => dispatch({ type: 'end', e: JSON.parse((ev as MessageEvent).data) })
    const onBuild = (ev: Event) => dispatch({ type: 'build', e: JSON.parse((ev as MessageEvent).data) })
    es.addEventListener('snapshot', onSnapshot)
    es.addEventListener('start', onStart)
    es.addEventListener('gen', onGen)
    es.addEventListener('end', onEnd)
    es.addEventListener('build', onBuild)
    return () => {
      es.removeEventListener('snapshot', onSnapshot)
      es.removeEventListener('start', onStart)
      es.removeEventListener('gen', onGen)
      es.removeEventListener('end', onEnd)
      es.removeEventListener('build', onBuild)
    }
  }, [])
  return state
}
