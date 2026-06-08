import { useState } from 'react'
import type { GemSkillResult } from './types.js'

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }
const skill: React.CSSProperties = { marginBottom: 10 }
const name: React.CSSProperties = { color: '#cdd3dd', marginBottom: 2 }
const gem: React.CSSProperties = { fontSize: 11, paddingLeft: 8 }
const button: React.CSSProperties = {
  flex: 1,
  background: '#1a2230',
  border: '1px solid #2a3140',
  borderRadius: 6,
  font: '12px ui-monospace, monospace',
  padding: '6px 10px',
  cursor: 'pointer',
}

function pct(after: number, before: number): string {
  const d = Math.round((after / Math.max(before, 1) - 1) * 100)
  return `${d >= 0 ? '+' : ''}${d}%`
}

// per-skill recommended support changes: added green, kept neutral, removed red (struck)
export function GemDiff({ results, onMutate }: { results: GemSkillResult[]; onMutate: () => void }) {
  const [busy, setBusy] = useState<'apply' | 'revert' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  if (results.length === 0 || hidden) {
    return null
  }

  async function post(url: string, kind: 'apply' | 'revert', successMsg: string) {
    setBusy(kind)
    setMsg(null)
    try {
      const r = await fetch(url, { method: 'POST' })
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(b.error ?? `${kind} failed (${r.status})`)
      }
      setMsg(successMsg)
      setHidden(true)
      onMutate()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div style={head}>recommended gems</div>
      {results.map((r) => (
        <div key={r.group} style={skill}>
          <div style={name}>
            {r.main_skill} <span style={{ color: '#5bd97a' }}>{pct(r.score, r.score_before)}</span>
          </div>
          {r.supports.map((s) => (
            <div key={s.id} style={{ ...gem, color: s.kept ? '#8a93a6' : '#5bd97a' }}>
              <span>{s.kept ? '= ' : '+ '}</span>
              <span>{s.name}</span>
            </div>
          ))}
          {r.removed.map((s) => (
            <div key={s.id} style={{ ...gem, color: '#d95b5b' }}>
              <span>- </span>
              <span style={{ textDecoration: 'line-through' }}>{s.name}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button
          style={{ ...button, color: '#5bd97a' }}
          disabled={busy !== null}
          onClick={() => void post('/api/gem-search/apply', 'apply', 'changes applied')}
        >
          {busy === 'apply' ? '…' : 'apply changes'}
        </button>
        <button
          style={{ ...button, color: '#d95b5b' }}
          disabled={busy !== null}
          onClick={() => void post('/api/revert', 'revert', 'reverted to original')}
        >
          {busy === 'revert' ? '…' : 'revert'}
        </button>
      </div>
      {msg ? <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>{msg}</div> : null}
    </div>
  )
}
