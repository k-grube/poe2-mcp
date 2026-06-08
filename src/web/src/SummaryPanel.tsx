import type { BuildSummary, SocketGroup, Gem, MinionSkillsInfo } from './types.js'
import { SET1, SET2 } from './nodeStyle.js'

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

function SkillGroup({
  g,
  skillDps,
  minionInfo,
  onMutate,
}: {
  g: SocketGroup
  skillDps: Map<string, number>
  minionInfo?: MinionSkillsInfo
  onMutate: () => void
}) {
  // only show an explicit title when there's a user label; otherwise the gem list speaks for itself
  const title = g.label || (!g.main_skill_name ? `group ${g.index}` : null)
  const actives = g.gems.filter((x) => !x.support)
  const supports = g.gems.filter((x) => x.support)
  const setMain = async () => {
    const r = await fetch('/api/main-socket-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: g.index }),
    })
    if (r.ok) {
      onMutate()
    }
  }
  const activeRowStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    paddingLeft: 8,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    color: g.is_main ? '#d9b45b' : '#cdd3dd',
    cursor: g.is_main ? 'default' : 'pointer',
    ...extra,
  })
  return (
    <div style={{ marginBottom: 8, opacity: g.enabled ? 1 : 0.5 }}>
      {title && (
        <div
          style={{ color: g.is_main ? '#d9b45b' : '#cdd3dd', cursor: g.is_main ? 'default' : 'pointer' }}
          onClick={g.is_main ? undefined : setMain}
          title={g.is_main ? 'main skill' : 'click to set as main skill'}
        >
          {title}
        </div>
      )}
      {actives.map((x, i) => {
        const dps = skillDps.get(x.name)
        return (
          <div
            key={`a${i}`}
            style={activeRowStyle()}
            onClick={g.is_main ? undefined : setMain}
            title={g.is_main ? 'main skill' : 'click to set as main skill'}
          >
            <span>
              {x.name}
              <span style={{ opacity: 0.5 }}>{gemMeta(x)}</span>
            </span>
            {dps ? <span style={{ opacity: 0.7 }}>{fmt(dps)}</span> : null}
          </div>
        )
      })}
      {minionInfo && minionInfo.skills.length > 1 ? (
        <MinionSkillSelect group={g.index} info={minionInfo} onMutate={onMutate} />
      ) : null}
      {supports.map((x, i) => (
        <div key={`s${i}`} style={{ paddingLeft: 16, opacity: 0.6 }}>
          + {x.name}
          {gemMeta(x)}
        </div>
      ))}
    </div>
  )
}

function MinionSkillSelect({ group, info, onMutate }: { group: number; info: MinionSkillsInfo; onMutate: () => void }) {
  return (
    <div style={{ paddingLeft: 16, marginTop: 2, opacity: 0.85 }}>
      <span style={{ opacity: 0.55 }}>uses </span>
      <select
        value={info.current_skill_index}
        onChange={async (e) => {
          const skill_index = Number(e.target.value)
          const r = await fetch('/api/minion-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group, skill_index }),
          })
          if (r.ok) {
            onMutate()
          }
        }}
        style={{
          background: '#0e1218',
          color: '#cdd3dd',
          border: '1px solid #2a3140',
          font: 'inherit',
          padding: '1px 4px',
          maxWidth: 200,
        }}
      >
        {info.skills.map((s) => (
          <option key={s.index} value={s.index}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SummaryPanel({ summary, onMutate }: { summary: BuildSummary; onMutate: () => void }) {
  const { info, dps, ehp, breakpoints, tree, socket_groups } = summary
  const d = dps as { full_dps?: number; skills?: Array<{ name: string; dps: number }> }
  // skills[] from get_dps is sorted dps desc; keep the highest per name so
  // the main socket group's contribution isn't clobbered by a lower auto-group entry
  const skillDps = new Map<string, number>()
  for (const s of d.skills ?? []) {
    if (!skillDps.has(s.name)) {
      skillDps.set(s.name, s.dps)
    }
  }
  // PoB auto-generates socket groups from item/passive grants (source = "Item:..." / "Tree:...").
  // these are shown separately in PoB's own ui; treat them as not part of the user's build here
  // so the same skill doesn't appear twice (once as the real group, once as the L1 grant)
  const userGroups = socket_groups.groups.filter((g) => {
    const src = g.source ?? ''
    return !src.startsWith('Item:') && !src.startsWith('Tree:')
  })
  const minionByGroup = new Map((summary.minion_skills ?? []).map((m) => [m.group, m]))
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
      {userGroups.map((g) => (
        <SkillGroup
          key={g.index}
          g={g}
          skillDps={skillDps}
          minionInfo={minionByGroup.get(g.index)}
          onMutate={onMutate}
        />
      ))}

      <div style={head}>tree · {tree.points_used} pts</div>
      {info.weapon_sets && info.weapon_sets.max > 0 ? (
        <div style={{ marginBottom: 2 }}>
          weapon sets:{' '}
          <span style={{ color: SET1 }}>
            set 1 {info.weapon_sets.set1}/{info.weapon_sets.max}
          </span>{' '}
          ·{' '}
          <span style={{ color: SET2 }}>
            set 2 {info.weapon_sets.set2}/{info.weapon_sets.max}
          </span>
        </div>
      ) : null}
      <div>keystones: {tree.keystones.join(', ') || '-'}</div>
    </div>
  )
}
