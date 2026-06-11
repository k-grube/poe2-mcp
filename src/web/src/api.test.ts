import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch } from './api.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('apiFetch', () => {
  it('returns parsed json on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: 1 }) }))
    await expect(apiFetch('/x')).resolves.toEqual({ a: 1 })
  })

  it('throws the server error message on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'boom' }) }))
    await expect(apiFetch('/x')).rejects.toThrow('boom')
  })

  it('falls back to the status when the error body has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(apiFetch('/x')).rejects.toThrow('500')
  })

  it('rejects with a timeout error when the request stalls past timeoutMs', async () => {
    vi.useFakeTimers()
    // a stalled request: only settles when its abort signal fires (the real-fetch contract)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      ),
    )
    const assertion = expect(apiFetch('/x', { timeoutMs: 1000 })).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })
})
