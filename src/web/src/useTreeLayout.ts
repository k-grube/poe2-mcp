import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'
import type { TreeLayout } from './types.js'

export interface LayoutState {
  layout: TreeLayout | null
  error: string | null
}

// fetches /api/tree-layout, polling until it succeeds. the server 409s until a
// build is loaded (and during dev restarts), so we wait rather than hard-erroring.
export function useTreeLayout(): LayoutState {
  const [state, setState] = useState<LayoutState>({ layout: null, error: null })
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const ctrl = new AbortController()
    const attempt = () => {
      apiFetch<TreeLayout>('/api/tree-layout', { signal: ctrl.signal })
        .then((layout) => {
          if (!cancelled) {
            setState({ layout, error: null })
          }
        })
        .catch(() => {
          // no build loaded yet, server restarting, or the request stalled (apiFetch times
          // it out instead of leaving the poll hung) -> keep waiting
          if (!cancelled) {
            timer = setTimeout(attempt, 2000)
          }
        })
    }
    attempt()
    return () => {
      cancelled = true
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])
  return state
}
