import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/search-jobs.js', () => ({ getActiveJob: vi.fn() }))
vi.mock('../src/gem-search-jobs.js', () => ({ getActiveGemJob: vi.fn() }))

import { anySearchRunning } from '../src/search-lock.js'
import { getActiveJob } from '../src/search-jobs.js'
import { getActiveGemJob } from '../src/gem-search-jobs.js'

beforeEach(() => {
  vi.mocked(getActiveJob).mockReset()
  vi.mocked(getActiveGemJob).mockReset()
})

describe('anySearchRunning', () => {
  it('reports tree', () => {
    vi.mocked(getActiveJob).mockReturnValue({ status: 'running' } as never)
    vi.mocked(getActiveGemJob).mockReturnValue(null)
    expect(anySearchRunning()).toEqual({ running: true, kind: 'tree' })
  })
  it('reports gem', () => {
    vi.mocked(getActiveJob).mockReturnValue(null)
    vi.mocked(getActiveGemJob).mockReturnValue({ status: 'running' } as never)
    expect(anySearchRunning()).toEqual({ running: true, kind: 'gem' })
  })
  it('reports idle', () => {
    vi.mocked(getActiveJob).mockReturnValue({ status: 'done' } as never)
    vi.mocked(getActiveGemJob).mockReturnValue(null)
    expect(anySearchRunning()).toEqual({ running: false, kind: null })
  })
})
