import { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0c0e12',
  color: '#cdd3dd',
  border: '1px solid #2a3140',
  borderRadius: 6,
  font: '12px ui-monospace, monospace',
  padding: 6,
  boxSizing: 'border-box',
  resize: 'vertical',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 6,
  width: '100%',
  background: '#1a2230',
  color: '#d9b45b',
  border: '1px solid #2a3140',
  borderRadius: 6,
  font: '12px ui-monospace, monospace',
  padding: '6px 10px',
  cursor: 'pointer',
}

// paste a PoB2 export code -> POST /api/load-build. on success the server emits a
// `build` sse event, which refreshes the summary; this panel just owns the post.
export function LoadPanel({ disabled = false }: { disabled?: boolean }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = code.trim()
    if (!trimmed) {
      return
    }
    setBusy(true)
    setError(null)
    // server caps load_build at 30s; no response by 35s means the request never left the
    // browser (chrome's 6-per-origin socket pool, usually too many localhost tabs open)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 35_000)
    try {
      const r = await fetch('/api/load-build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pob_code: trimmed }),
        signal: ctrl.signal,
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `load failed (${r.status})`)
      }
      setCode('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(
          'load timed out, no response in 35s. close other localhost tabs (too many open exhausts the browser connection pool) and retry',
        )
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      clearTimeout(timer)
      setBusy(false)
    }
  }

  return (
    <div>
      <textarea
        value={code}
        onChange={(ev) => setCode(ev.target.value)}
        placeholder="paste PoB2 export code"
        rows={3}
        style={inputStyle}
      />
      <button onClick={submit} disabled={busy || !code.trim() || disabled} style={buttonStyle}>
        {busy ? 'loading…' : 'load build'}
      </button>
      {error ? <div style={{ color: '#d95b5b', marginTop: 6 }}>{error}</div> : null}
      {disabled ? <div style={{ opacity: 0.5, marginTop: 6 }}>cancel the search to load a new build</div> : null}
    </div>
  )
}
