import type { StreamState } from './useSearchStream.js'
import type { TreeNode } from './types.js'

const box: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(14,18,24,0.85)',
  color: '#cdd3dd',
  border: '1px solid #2a3140',
  borderRadius: 8,
  padding: '8px 12px',
  font: '12px ui-monospace, monospace',
}

function StatusChip({ s }: { s: StreamState }) {
  const dot = { idle: '#6b7280', running: '#d9b45b', done: '#5bd97a', cancelled: '#d99b5b', error: '#d95b5b' }[s.status]
  const last = s.scoreHistory[s.scoreHistory.length - 1]
  return (
    <div style={{ ...box, top: 12, left: 12 }}>
      <span style={{ color: dot }}>●</span> {s.status} · gen {s.generation}/{s.totalGenerations} ·{' '}
      {last ? Math.round(last.champion).toLocaleString() : '—'} · {s.pointsUsed} pts · {last?.elapsed ?? 0}s
    </div>
  )
}

function ScoreChart({ s }: { s: StreamState }) {
  if (s.scoreHistory.length < 2) {
    return null
  }
  const w = 220
  const h = 90
  const xs = s.scoreHistory.map((p) => p.generation)
  const all = s.scoreHistory.flatMap((p) => [p.best, p.avg, p.champion])
  const maxX = Math.max(...xs)
  const minX = Math.min(...xs)
  const maxY = Math.max(...all)
  const minY = Math.min(...all)
  const sx = (g: number) => ((g - minX) / Math.max(1, maxX - minX)) * w
  const sy = (v: number) => h - ((v - minY) / Math.max(1, maxY - minY)) * h
  const path = (key: 'best' | 'avg' | 'champion') =>
    s.scoreHistory.map((p, i) => `${i ? 'L' : 'M'}${sx(p.generation).toFixed(1)} ${sy(p[key]).toFixed(1)}`).join(' ')
  return (
    <div style={{ ...box, bottom: 12, right: 12 }}>
      <svg width={w} height={h}>
        <path d={path('avg')} fill="none" stroke="#5b8fd9" strokeWidth={1.5} opacity={0.7} />
        <path d={path('best')} fill="none" stroke="#5bd97a" strokeWidth={1.5} opacity={0.8} />
        <path d={path('champion')} fill="none" stroke="#d9b45b" strokeWidth={2} />
      </svg>
      <div>champion / best / avg</div>
    </div>
  )
}

function StatsPanel({ s }: { s: StreamState }) {
  if (!s.initial) {
    return null
  }
  const keys = Object.keys(s.championStats)
  return (
    <div style={{ ...box, bottom: 12, left: 12, maxHeight: '40vh', overflow: 'auto' }}>
      {keys.map((k) => {
        const cur = s.championStats[k]
        const base = s.initial!.stats[k] ?? 0
        const delta = cur - base
        let color = '#cdd3dd'
        if (delta > 0) {
          color = '#5bd97a'
        } else if (delta < 0) {
          color = '#d95b5b'
        }
        return (
          <div key={k}>
            {k}: {Math.round(cur).toLocaleString()}{' '}
            <span style={{ color }}>
              ({delta >= 0 ? '+' : ''}
              {Math.round(delta).toLocaleString()})
            </span>
          </div>
        )
      })}
    </div>
  )
}

function HoverPanel({ node }: { node: TreeNode | null }) {
  if (!node) {
    return null
  }
  return (
    <div style={{ ...box, top: 12, right: 12, maxWidth: 300, lineHeight: 1.5 }}>
      <div style={{ color: '#d9b45b', fontWeight: 'bold' }}>{node.name}</div>
      <div style={{ opacity: 0.6 }}>
        {node.type}
        {node.ascendancy ? ` · ${node.ascendancy}` : ''}
      </div>
      {node.stats?.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  )
}

export function Hud({ state, hover }: { state: StreamState; hover: TreeNode | null }) {
  return (
    <>
      <StatusChip s={state} />
      <HoverPanel node={hover} />
      <ScoreChart s={state} />
      <StatsPanel s={state} />
    </>
  )
}
