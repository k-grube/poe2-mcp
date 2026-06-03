import { useState } from 'react'
import type { StreamState } from './useSearchStream.js'

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }
const button: React.CSSProperties = {
  marginTop: 8,
  width: '100%',
  background: '#1a2230',
  color: '#d9b45b',
  border: '1px solid #2a3140',
  borderRadius: 6,
  font: '12px ui-monospace, monospace',
  padding: '6px 10px',
  cursor: 'pointer',
}

// export the active build to a PoB code (clipboard) and revert the live build to the
// pre-search baseline. revert appears once a search has run; the server clears the
// baseline on revert/load, and the resulting 'build' sse event refreshes the viz.
export function BuildActions({ stream }: { stream: StreamState }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const running = stream.status === 'running'
  const canRevert = stream.status === 'done' || stream.status === 'cancelled'

  async function exportCode() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/export')
      const b = (await r.json()) as { pob_code?: string; error?: string }
      if (!r.ok) {
        throw new Error(b.error ?? `export failed (${r.status})`)
      }
      await navigator.clipboard?.writeText(b.pob_code ?? '')
      setMsg('copied PoB code to clipboard')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function revert() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/revert', { method: 'POST' })
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(b.error ?? `revert failed (${r.status})`)
      }
      setMsg('reverted to pre-search build')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={head}>build</div>
      <button onClick={exportCode} disabled={busy || running} style={button}>
        {busy ? '…' : 'export PoB code'}
      </button>
      {canRevert ? (
        <button onClick={revert} disabled={busy} style={{ ...button, color: '#d95b5b' }}>
          revert search
        </button>
      ) : null}
      {msg ? <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>{msg}</div> : null}
    </div>
  )
}
