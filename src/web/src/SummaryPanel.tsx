import { useState } from 'react'
import type { BuildSummary, SocketGroup, Gem, MinionSkillsInfo } from './types.js'
import { apiFetch } from './api.js'
import { SET1, SET2 } from './nodeStyle.js'
import type { RightPanelSpec } from './RightPanel.js'
import { ExplainStatPanel } from './ExplainStatPanel.js'

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
function Res({
  label,
  stat,
  value,
  capped,
  onExplain,
}: {
  label: string
  stat: string
  value?: number
  capped?: boolean
  onExplain: (stat: string, title: string) => void
}) {
  let color = '#cdd3dd'
  if (capped === true) {
    color = GREEN
  } else if (capped === false || (value ?? 0) < 0) {
    color = RED
  }
  return (
    <span
      style={{ color, cursor: 'pointer' }}
      onClick={() => onExplain(stat, `${label} ${value ?? '-'}`)}
      title="click to explain"
    >
      {label} {value ?? '-'}
    </span>
  )
}

const explainable: React.CSSProperties = { cursor: 'pointer', borderBottom: '1px dotted #4a5160' }

function SkillGroup({
  g,
  skillDps,
  minionInfo,
  mutate,
}: {
  g: SocketGroup
  skillDps: Map<string, number>
  minionInfo?: MinionSkillsInfo
  mutate: (path: string, body: unknown) => void
}) {
  // only show an explicit title when there's a user label; otherwise the gem list speaks for itself
  const title = g.label || (!g.main_skill_name ? `group ${g.index}` : null)
  const actives = g.gems.filter((x) => !x.support)
  const supports = g.gems.filter((x) => x.support)
  const setMain = () => {
    mutate('/api/main-socket-group', { index: g.index })
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
        <MinionSkillSelect group={g.index} info={minionInfo} mutate={mutate} />
      ) : null}
      {supports.map((x, i) => (
        <div key={`s${i}`} style={{ paddingLeft: 16, opacity: 0.6, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>
            + {x.name}
            {gemMeta(x)}
          </span>
          {x.id ? (
            <button
              title={`reroll just this support (keep the other ${supports.length - 1} fixed)`}
              onClick={(e) => {
                e.stopPropagation()
                mutate('/api/gem-search/start', {
                  objective: { stat: 'FullDPS' },
                  mode: { idealized: true },
                  scope: [g.index],
                  reroll: x.id,
                })
              }}
              style={{
                background: 'transparent',
                border: '1px solid #2a3140',
                borderRadius: 4,
                color: '#8a93a6',
                cursor: 'pointer',
                font: 'inherit',
                padding: '0 4px',
                opacity: 0.85,
              }}
            >
              ↻
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function MinionSkillSelect({
  group,
  info,
  mutate,
}: {
  group: number
  info: MinionSkillsInfo
  mutate: (path: string, body: unknown) => void
}) {
  return (
    <div style={{ paddingLeft: 16, marginTop: 2, opacity: 0.85 }}>
      <span style={{ opacity: 0.55 }}>uses </span>
      <select
        value={info.current_skill_index}
        onChange={(e) => {
          mutate('/api/minion-skill', { group, skill_index: Number(e.target.value) })
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

export function SummaryPanel({
  summary,
  onMutate,
  onShowRight,
}: {
  summary: BuildSummary
  onMutate: () => void
  onShowRight?: (spec: RightPanelSpec | null) => void
}) {
  const [mutErr, setMutErr] = useState<string | null>(null)
  // every summary-panel mutation refreshes the summary on success and surfaces the failure
  // instead of silently no-op'ing (a failed set-main/minion-skill used to show nothing)
  const mutate = (path: string, body: unknown) => {
    setMutErr(null)
    apiFetch(path, { method: 'POST', body })
      .then(() => onMutate())
      .catch((e) => setMutErr(e instanceof Error ? e.message : String(e)))
  }
  const explain = (stat: string, title: string) => {
    if (onShowRight) {
      onShowRight({ title, body: () => <ExplainStatPanel stat={stat} /> })
    }
  }
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
  const userGroups = socket_groups.groups
    .filter((g) => {
      const src = g.source ?? ''
      return !src.startsWith('Item:') && !src.startsWith('Tree:')
    })
    .map((g) => {
      const groupDps = g.gems.filter((x) => !x.support).reduce((m, x) => Math.max(m, skillDps.get(x.name) ?? 0), 0)
      return { g, groupDps }
    })
    .sort((a, b) => b.groupDps - a.groupDps)
    .map((x) => x.g)
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
        <span style={explainable} onClick={() => explain('Life', `life ${fmt(e.life)}`)}>
          life {fmt(e.life)}
        </span>{' '}
        ·{' '}
        <span style={explainable} onClick={() => explain('EnergyShield', `ES ${fmt(e.es)}`)}>
          ES {fmt(e.es)}
        </span>
        {e.ward ? (
          <>
            {' '}
            ·{' '}
            <span style={explainable} onClick={() => explain('Ward', `ward ${fmt(e.ward)}`)}>
              ward {fmt(e.ward)}
            </span>
          </>
        ) : null}
      </div>
      <div>
        <span style={explainable} onClick={() => explain('Armour', `armour ${fmt(e.armour)}`)}>
          armour {fmt(e.armour)}
        </span>{' '}
        ·{' '}
        <span style={explainable} onClick={() => explain('Evasion', `evasion ${fmt(e.evasion)}`)}>
          evasion {fmt(e.evasion)}
        </span>
      </div>
      <div>
        block {e.block_chance ?? 0}% · suppress {e.spell_suppress ?? 0}%
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
        <Res label="fire" stat="FireResist" value={bp.fire_res} capped={bp.fire_res_capped} onExplain={explain} />
        <Res label="cold" stat="ColdResist" value={bp.cold_res} capped={bp.cold_res_capped} onExplain={explain} />
        <Res
          label="light"
          stat="LightningResist"
          value={bp.lightning_res}
          capped={bp.lightning_res_capped}
          onExplain={explain}
        />
        <Res label="chaos" stat="ChaosResist" value={bp.chaos_res} onExplain={explain} />
      </div>

      <div style={head}>skills</div>
      {userGroups.map((g) => (
        <SkillGroup key={g.index} g={g} skillDps={skillDps} minionInfo={minionByGroup.get(g.index)} mutate={mutate} />
      ))}
      {mutErr ? <div style={{ color: RED, fontSize: 11, marginTop: 4 }}>{mutErr}</div> : null}

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
