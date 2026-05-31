import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchPanel } from './SearchPanel.js'
import { initialState } from './useSearchStream.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SearchPanel', () => {
  it('starts a search with the chosen objective + start mode', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    render(<SearchPanel stream={initialState} />)
    fireEvent.click(screen.getByText(/start search/i))
    await waitFor(() => expect(f).toHaveBeenCalled())
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('/api/search')
    const body = JSON.parse(opts.body)
    expect(body.objective).toEqual({ stat: 'FullDPS' })
    expect(body.start_mode).toBe('current')
  })

  it('cancels the running search by job_id', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    render(<SearchPanel stream={{ ...initialState, status: 'running', jobId: 'j1' }} />)
    fireEvent.click(screen.getByText(/cancel search/i))
    await waitFor(() => expect(f).toHaveBeenCalled())
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('/api/search/cancel')
    expect(JSON.parse(opts.body)).toEqual({ job_id: 'j1' })
  })
})
