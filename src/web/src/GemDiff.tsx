import type { GemSkillResult } from './types.js'

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }
const skill: React.CSSProperties = { marginBottom: 10 }
const name: React.CSSProperties = { color: '#cdd3dd', marginBottom: 2 }
const gem: React.CSSProperties = { fontSize: 11, paddingLeft: 8 }

function pct(after: number, before: number): string {
  const d = Math.round((after / Math.max(before, 1) - 1) * 100)
  return `${d >= 0 ? '+' : ''}${d}%`
}

// per-skill recommended support changes: added green, kept neutral, removed red (struck)
export function GemDiff({ results }: { results: GemSkillResult[] }) {
  if (results.length === 0) {
    return null
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
    </div>
  )
}
