// one fetch seam for the viz. every request is bounded by a hard timeout that forces a
// rejection, so a stalled request surfaces as an error instead of hanging forever (chrome
// caps connections at 6 per origin across all open tabs; too many localhost tabs exhausts
// the pool and new fetches stall silently). non-ok responses throw the server's {error}
// message. pass signal to abort on unmount.

// matches the bridge's 30s command cap with headroom: a request still pending at 35s never
// reached the server.
const DEFAULT_TIMEOUT_MS = 35_000

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = opts
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) {
      ctrl.abort()
    } else {
      signal.addEventListener('abort', onAbort)
    }
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, timeoutMs)
  try {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!r.ok) {
      let serverMsg: string | undefined
      try {
        const b = (await r.json()) as { error?: string }
        serverMsg = b?.error
      } catch {
        // no/non-json error body, fall back to the status
      }
      throw new ApiError(serverMsg ?? `${path} (${r.status})`, r.status)
    }
    return (await r.json()) as T
  } catch (err) {
    if (timedOut) {
      throw new ApiError(
        `request timed out: ${path}. close other localhost tabs (too many open exhausts the browser connection pool) and retry`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}
