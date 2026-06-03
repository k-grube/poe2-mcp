import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GemSearchPanel } from './GemSearchPanel.js'
import { gemInitialState } from './useGemSearchStream.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GemSearchPanel', () => {
  it('posts to /api/gem-search/start on optimize', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    render(<GemSearchPanel gem={gemInitialState} />)
    fireEvent.click(screen.getByText(/optimize gems/i))
    await waitFor(() =>
      expect(f).toHaveBeenCalledWith('/api/gem-search/start', expect.objectContaining({ method: 'POST' })),
    )
  })

  it('shows cancel + progress while running', () => {
    render(
      <GemSearchPanel
        gem={{
          ...gemInitialState,
          status: 'running',
          jobId: 'j1',
          progress: {
            job_id: 'j1',
            status: 'running',
            group: 3,
            main_skill: 'Ice Shot',
            phase: 'greedy',
            step: 2,
            total_steps: 5,
            best_score: 300,
            score_before: 235,
            current_supports: [],
            done_results: [],
            group_ordinal: 1,
            total_groups: 1,
          },
        }}
      />,
    )
    expect(screen.getByText(/cancel/i)).toBeTruthy()
    expect(screen.getByText(/Ice Shot/)).toBeTruthy()
  })
})
