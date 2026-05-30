import type { BuildSummary, SocketGroup } from './types.js'

const fmt = (n: unknown): string => (typeof n === 'number' ? Math.round(n).toLocaleString() : '-')

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }

function SkillGroup({ g, skillDps }: { g: SocketGroup; skillDps: Map<string, number> }) {
  // only show an explicit title when there's a user label; otherwise the gem list speaks for itself
  const title = g.label || (!g.main_skill_name ? `group ${g.index}` : null)
  const actives = g.gems.filter((x) => !x.support)
  const supports = g.gems.filter((x) => x.support)
  return (
    <div style={{ marginBottom: 8, opacity: g.enabled ? 1 : 0.5 }}>
      {title && <div style={{ color: g.is_main ? '#d9b45b' : '#cdd3dd' }}>{title}</div>}
      {actives.map((x, i) => {
        const dps = skillDps.get(x.name)
        return (
          <div
            key={`a${i}`}
            style={{
              paddingLeft: 8,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              color: g.is_main ? '#d9b45b' : '#cdd3dd',
            }}
          >
            <span>{x.name}</span>
            {dps ? <span style={{ opacity: 0.7 }}>{fmt(dps)}</span> : null}
          </div>
        )
      })}
      {supports.map((x, i) => (
        <div key={`s${i}`} style={{ paddingLeft: 16, opacity: 0.6 }}>
          + {x.name}
        </div>
      ))}
    </div>
  )
}

export function SummaryPanel({ summary }: { summary: BuildSummary }) {
  const { info, dps, ehp, breakpoints, tree, socket_groups } = summary
  const d = dps as { full_dps?: number; skills?: Array<{ name: string; dps: number }> }
  const skillDps = new Map((d.skills ?? []).map((s) => [s.name, s.dps]))
  const e = ehp as { total_ehp?: number }
  const bp = breakpoints as { fire_res?: number; cold_res?: number; lightning_res?: number; chaos_res?: number }
  return (
    <div>
      <div style={{ color: '#d9b45b', fontWeight: 'bold' }}>
        {info.class_name} / {info.ascendancy}
      </div>
      <div style={{ opacity: 0.7 }}>
        lvl {info.level} · {info.main_skill}
      </div>

      <div style={head}>stats</div>
      <div>DPS {fmt(d.full_dps)}</div>
      <div>EHP {fmt(e.total_ehp)}</div>
      <div>
        res {fmt(bp.fire_res)}/{fmt(bp.cold_res)}/{fmt(bp.lightning_res)}/{fmt(bp.chaos_res)}
      </div>

      <div style={head}>skills</div>
      {socket_groups.groups.map((g) => (
        <SkillGroup key={g.index} g={g} skillDps={skillDps} />
      ))}

      <div style={head}>tree · {tree.points_used} pts</div>
      <div>keystones: {tree.keystones.join(', ') || '-'}</div>
      <div style={{ opacity: 0.7 }}>notables: {tree.notables.join(', ') || '-'}</div>
    </div>
  )
}
