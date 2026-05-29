import { useEffect, useState } from 'react'
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
    const attempt = () => {
      fetch('/api/tree-layout')
        .then((r) => {
          if (!r.ok) {
            throw new Error(`tree-layout ${r.status}`)
          }
          return r.json() as Promise<TreeLayout>
        })
        .then((layout) => {
          if (!cancelled) {
            setState({ layout, error: null })
          }
        })
        .catch(() => {
          // no build loaded yet, or server restarting -> keep waiting
          if (!cancelled) {
            timer = setTimeout(attempt, 2000)
          }
        })
    }
    attempt()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])
  return state
}
