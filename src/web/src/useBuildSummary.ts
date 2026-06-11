import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './api.js'
import type { BuildInfo, BuildSummary } from './types.js'

export interface SummaryState {
  summary: BuildSummary | null
  loading: boolean
  error: string | null
  refetch: () => void
}

interface FetchResult {
  // identity of the (buildInfo, version) tuple this result belongs to. derived state
  // checks this against the current tuple to decide if the result is still valid.
  forBuildInfo: BuildInfo | null
  forVersion: number
  summary: BuildSummary | null
  error: string | null
}

const EMPTY: FetchResult = { forBuildInfo: null, forVersion: -1, summary: null, error: null }

// fetches /api/build-summary, re-fetching whenever the active build changes
// (buildInfo identity), or on demand via the returned refetch (used after mutations
// like set_minion_skill that change DPS without changing the build identity).
export function useBuildSummary(buildInfo: BuildInfo | null): SummaryState {
  const [result, setResult] = useState<FetchResult>(EMPTY)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!buildInfo) {
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    apiFetch<BuildSummary>('/api/build-summary', { signal: ctrl.signal })
      .then((s) => {
        if (!cancelled) {
          setResult({ forBuildInfo: buildInfo, forVersion: version, summary: s, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            forBuildInfo: buildInfo,
            forVersion: version,
            summary: null,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [buildInfo, version])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])
  const sameBuild = !!buildInfo && result.forBuildInfo === buildInfo
  const isCurrent = sameBuild && result.forVersion === version
  // while a refetch is in flight for the same build, keep the previous summary visible
  // so the panel doesn't flash empty between user mutations (e.g. minion-skill swap)
  const summary = sameBuild ? result.summary : null
  const error = isCurrent ? result.error : null
  const loading = !!buildInfo && !isCurrent
  return { summary, loading, error, refetch }
}
