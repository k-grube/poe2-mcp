import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BuildActions } from './BuildActions.js'
import { initialState } from './useSearchStream.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BuildActions', () => {
  it('exports the build via GET /api/export', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pob_code: 'abc' }) })
    vi.stubGlobal('fetch', f)
    render(<BuildActions stream={initialState} />)
    fireEvent.click(screen.getByText(/export pob code/i))
    await waitFor(() => expect(f).toHaveBeenCalledWith('/api/export'))
  })

  it('reveals revert only after a search, then posts /api/revert', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    const { rerender } = render(<BuildActions stream={initialState} />)
    expect(screen.queryByText(/revert search/i)).toBeNull()
    rerender(<BuildActions stream={{ ...initialState, status: 'done' }} />)
    fireEvent.click(screen.getByText(/revert search/i))
    await waitFor(() => expect(f).toHaveBeenCalledWith('/api/revert', { method: 'POST' }))
  })
})
