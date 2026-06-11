import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'
import type { GemStreamState } from './useGemSearchStream.js'

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }
const input: React.CSSProperties = {
  background: '#0c0e12',
  color: '#cdd3dd',
  border: '1px solid #2a3140',
  borderRadius: 6,
  font: '12px ui-monospace, monospace',
  padding: '4px 6px',
  boxSizing: 'border-box',
}
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 4,
}
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

const OBJECTIVES = ['FullDPS', 'TotalDPS', 'TotalEHP']

export function GemSearchPanel({ gem }: { gem: GemStreamState }) {
  const [objective, setObjective] = useState('FullDPS')
  const [scope, setScope] = useState('main')
  const [idealized, setIdealized] = useState(true)
  const [excludeLineage, setExcludeLineage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const running = gem.status === 'running'
  // tick a clock while running so the user sees something moving between progress events.
  // start timestamp is a ref derived during render when running flips; a tick state forces
  // re-renders every 250ms while running so the displayed elapsed value updates.
  const startRef = useRef<number | null>(null)
  if (running && startRef.current === null) {
    startRef.current = Date.now()
  } else if (!running && startRef.current !== null) {
    startRef.current = null
  }
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!running) {
      return
    }
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [running])
  const elapsed = startRef.current === null ? 0 : Math.floor((Date.now() - startRef.current) / 1000)

  async function post(url: string, body: unknown) {
    setBusy(true)
    setError(null)
    try {
      await apiFetch(url, { method: 'POST', body })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function start() {
    void post('/api/gem-search/start', {
      objective: { stat: objective },
      mode: { idealized },
      scope,
      exclude_lineage: excludeLineage,
    })
  }
  function cancel() {
    if (!gem.jobId) {
      return
    }
    void post('/api/gem-search/cancel', { job_id: gem.jobId })
  }

  const p = gem.progress
  return (
    <div>
      <div style={head}>gem search</div>
      <label style={row}>
        <span style={{ opacity: 0.7 }}>objective</span>
        <select value={objective} onChange={(e) => setObjective(e.target.value)} style={input} disabled={running}>
          {OBJECTIVES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label style={row}>
        <span style={{ opacity: 0.7 }}>scope</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={input} disabled={running}>
          <option value="main">main skill</option>
          <option value="all">all (FullDPS)</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ opacity: 0.7 }}>mode</span>
        <select
          value={idealized ? 'ideal' : 'import'}
          onChange={(e) => setIdealized(e.target.value === 'ideal')}
          style={input}
          disabled={running}
        >
          <option value="ideal">idealized (Q20, 5 sockets)</option>
          <option value="import">as-imported</option>
        </select>
      </label>
      <label style={{ ...row, cursor: 'pointer' }}>
        <span style={{ opacity: 0.7 }}>exclude lineage</span>
        <input
          type="checkbox"
          checked={excludeLineage}
          onChange={(e) => setExcludeLineage(e.target.checked)}
          disabled={running}
        />
      </label>

      {running ? (
        <button onClick={cancel} disabled={busy} style={{ ...button, color: '#d95b5b' }}>
          {busy ? '…' : 'cancel'}
        </button>
      ) : (
        <button onClick={start} disabled={busy} style={button}>
          {busy ? '…' : 'optimize gems'}
        </button>
      )}

      {running ? (
        <div style={{ opacity: 0.7, fontSize: 11, marginTop: 6 }}>
          {p ? (
            <>
              {p.main_skill} ({p.group_ordinal}/{p.total_groups}) · {p.phase} {p.step}/{p.total_steps} ·{' '}
              <span style={{ color: '#5bd97a' }}>
                {Math.round((p.best_score / Math.max(p.score_before, 1) - 1) * 100)}%
              </span>{' '}
              · <span style={{ opacity: 0.7 }}>{elapsed}s</span>
            </>
          ) : (
            <>
              starting… <span style={{ opacity: 0.7 }}>{elapsed}s</span>
            </>
          )}
        </div>
      ) : null}
      {error ? <div style={{ color: '#d95b5b', marginTop: 6 }}>{error}</div> : null}
    </div>
  )
}
