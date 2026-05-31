import { useEffect, useState } from 'react'
import type { BuildInfo, BuildSummary } from './types.js'

export interface SummaryState {
  summary: BuildSummary | null
  loading: boolean
  error: string | null
}

// fetches /api/build-summary, re-fetching whenever the active build changes
// (buildInfo identity). a null buildInfo means no build loaded -> null summary.
export function useBuildSummary(buildInfo: BuildInfo | null): SummaryState {
  const [state, setState] = useState<SummaryState>({ summary: null, loading: false, error: null })
  useEffect(() => {
    if (!buildInfo) {
      setState({ summary: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetch('/api/build-summary')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`build-summary ${r.status}`)
        }
        return r.json() as Promise<BuildSummary>
      })
      .then((summary) => {
        if (!cancelled) {
          setState({ summary, loading: false, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ summary: null, loading: false, error: err instanceof Error ? err.message : String(err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [buildInfo])
  return state
}
