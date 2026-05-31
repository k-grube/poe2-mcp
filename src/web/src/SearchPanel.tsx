import { useState } from 'react'
import type { StreamState } from './useSearchStream.js'

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

const OBJECTIVES = ['FullDPS', 'TotalEHP']
const KNOBS: Array<{ key: string; label: string; ph: string }> = [
  { key: 'generations', label: 'generations', ph: '10' },
  { key: 'population_size', label: 'population', ph: '8' },
  { key: 'hill_climb_depth', label: 'hill-climb', ph: '3' },
  { key: 'elitism', label: 'elitism', ph: '2' },
  { key: 'crossover_rate', label: 'crossover', ph: '0.7' },
  { key: 'tournament_size', label: 'tournament', ph: '3' },
  { key: 'seed', label: 'seed', ph: 'rng' },
]

// two-tier search config + start/cancel. simple: objective / point budget / start
// mode; advanced (collapsed): GA knobs. progress shows in the HUD via the sse stream.
export function SearchPanel({ stream }: { stream: StreamState }) {
  const [objective, setObjective] = useState('FullDPS')
  const [pointBudget, setPointBudget] = useState('')
  const [startMode, setStartMode] = useState('current')
  const [knobs, setKnobs] = useState<Record<string, string>>({})
  const [advanced, setAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const running = stream.status === 'running'

  async function post(url: string, body: unknown) {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(b.error ?? `request failed (${r.status})`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function start() {
    const body: Record<string, unknown> = { objective: { stat: objective }, start_mode: startMode }
    if (pointBudget.trim()) {
      body.point_budget = Number(pointBudget)
    }
    for (const { key } of KNOBS) {
      const v = knobs[key]
      if (v && v.trim()) {
        body[key] = Number(v)
      }
    }
    void post('/api/search', body)
  }

  function cancel() {
    if (!stream.jobId) {
      return
    }
    void post('/api/search/cancel', { job_id: stream.jobId })
  }

  return (
    <div>
      <div style={head}>search</div>
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
        <span style={{ opacity: 0.7 }}>point budget</span>
        <input
          value={pointBudget}
          onChange={(e) => setPointBudget(e.target.value)}
          placeholder="current"
          inputMode="numeric"
          style={{ ...input, width: 90 }}
          disabled={running}
        />
      </label>
      <label style={row}>
        <span style={{ opacity: 0.7 }}>start from</span>
        <select value={startMode} onChange={(e) => setStartMode(e.target.value)} style={input} disabled={running}>
          <option value="current">current tree</option>
          <option value="fresh">fresh</option>
        </select>
      </label>

      <button onClick={() => setAdvanced((a) => !a)} style={{ ...button, marginTop: 6, color: '#8a93a6' }}>
        {advanced ? 'hide advanced' : 'advanced'}
      </button>
      {advanced
        ? KNOBS.map(({ key, label, ph }) => (
            <label key={key} style={row}>
              <span style={{ opacity: 0.7 }}>{label}</span>
              <input
                value={knobs[key] ?? ''}
                onChange={(e) => setKnobs((k) => ({ ...k, [key]: e.target.value }))}
                placeholder={ph}
                inputMode="numeric"
                style={{ ...input, width: 90 }}
                disabled={running}
              />
            </label>
          ))
        : null}

      {running ? (
        <button onClick={cancel} disabled={busy} style={{ ...button, color: '#d95b5b' }}>
          {busy ? '…' : 'cancel search'}
        </button>
      ) : (
        <button onClick={start} disabled={busy} style={button}>
          {busy ? '…' : 'start search'}
        </button>
      )}
      {error ? <div style={{ color: '#d95b5b', marginTop: 6 }}>{error}</div> : null}
    </div>
  )
}
