import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoadPanel } from './LoadPanel.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoadPanel', () => {
  it('POSTs the pasted code to /api/load-build', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ class_name: 'Witch' }) })
    vi.stubGlobal('fetch', f)
    render(<LoadPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'abc123' } })
    fireEvent.click(screen.getByText(/load build/i))
    await waitFor(() => expect(f).toHaveBeenCalled())
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('/api/load-build')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ pob_code: 'abc123' })
  })

  it('shows the server error on a failed load', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'a search is already running' }) }),
    )
    render(<LoadPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'abc123' } })
    fireEvent.click(screen.getByText(/load build/i))
    await waitFor(() => expect(screen.getByText(/already running/)).toBeTruthy())
  })
})
