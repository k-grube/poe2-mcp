import type { BuildSummary, SocketGroup, Gem } from './types.js'

const fmt = (n: unknown): string => (typeof n === 'number' ? Math.round(n).toLocaleString() : '-')

const head: React.CSSProperties = { color: '#8a93a6', textTransform: 'uppercase', fontSize: 10, margin: '12px 0 4px' }

const GREEN = '#5bd97a'
const RED = '#d95b5b'

// " 20/8" level/quality suffix, or "" when level is unknown
function gemMeta(x: Gem): string {
  if (x.level == null) {
    return ''
  }
  return ` ${x.level}/${x.quality ?? 0}`
}

// capped -> green, under cap / negative -> red, unknown cap -> default
function Res({ label, value, capped }: { label: string; value?: number; capped?: boolean }) {
  let color = '#cdd3dd'
  if (capped === true) {
    color = GREEN
  } else if (capped === false || (value ?? 0) < 0) {
    color = RED
  }
  return (
    <span style={{ color }}>
      {label} {value ?? '-'}
    </span>
  )
}

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
            <span>
              {x.name}
              <span style={{ opacity: 0.5 }}>{gemMeta(x)}</span>
            </span>
            {dps ? <span style={{ opacity: 0.7 }}>{fmt(dps)}</span> : null}
          </div>
        )
      })}
      {supports.map((x, i) => (
        <div key={`s${i}`} style={{ paddingLeft: 16, opacity: 0.6 }}>
          + {x.name}
          {gemMeta(x)}
        </div>
      ))}
    </div>
  )
}

export function SummaryPanel({ summary }: { summary: BuildSummary }) {
  const { info, dps, ehp, breakpoints, tree, socket_groups } = summary
  const d = dps as { full_dps?: number; skills?: Array<{ name: string; dps: number }> }
  const skillDps = new Map((d.skills ?? []).map((s) => [s.name, s.dps]))
  const e = ehp as {
    total_ehp?: number
    life?: number
    es?: number
    ward?: number
    armour?: number
    evasion?: number
    block_chance?: number
    spell_suppress?: number
  }
  const bp = breakpoints as {
    fire_res?: number
    cold_res?: number
    lightning_res?: number
    chaos_res?: number
    fire_res_capped?: boolean
    cold_res_capped?: boolean
    lightning_res_capped?: boolean
  }
  return (
    <div>
      <div style={{ color: '#d9b45b', fontWeight: 'bold' }}>
        {info.class_name} / {info.ascendancy}
      </div>
      <div style={{ opacity: 0.7 }}>
        lvl {info.level} · {info.main_skill}
      </div>

      <div style={head}>offense</div>
      <div>DPS {fmt(d.full_dps)}</div>

      <div style={head}>defense</div>
      <div>EHP {fmt(e.total_ehp)}</div>
      <div>
        life {fmt(e.life)} · ES {fmt(e.es)}
        {e.ward ? ` · ward ${fmt(e.ward)}` : ''}
      </div>
      <div>
        armour {fmt(e.armour)} · evasion {fmt(e.evasion)}
      </div>
      <div>
        block {e.block_chance ?? 0}% · suppress {e.spell_suppress ?? 0}%
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
        <Res label="fire" value={bp.fire_res} capped={bp.fire_res_capped} />
        <Res label="cold" value={bp.cold_res} capped={bp.cold_res_capped} />
        <Res label="light" value={bp.lightning_res} capped={bp.lightning_res_capped} />
        <Res label="chaos" value={bp.chaos_res} />
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
