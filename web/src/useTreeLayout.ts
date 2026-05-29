import { useEffect, useState } from 'react'
import type { TreeLayout } from './types.js'

export interface LayoutState {
  layout: TreeLayout | null
  error: string | null
}

// fetches /api/tree-layout once; 409 surfaces as a user-facing error
export function useTreeLayout(): LayoutState {
  const [state, setState] = useState<LayoutState>({ layout: null, error: null })
  useEffect(() => {
    let cancelled = false
    fetch('/api/tree-layout')
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `tree-layout ${r.status}`)
        }
        return r.json() as Promise<TreeLayout>
      })
      .then((layout) => {
        if (!cancelled) {
          setState({ layout, error: null })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ layout: null, error: err instanceof Error ? err.message : String(err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
