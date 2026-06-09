import { useEffect, useState } from 'react'

interface Entry {
  value: number
  source: string
  name?: string
}

interface Explain {
  stat: string
  total: number | null
  base: Entry[]
  increased: Entry[]
  more: Entry[]
  flags: Entry[]
}

const sectionHead: React.CSSProperties = {
  color: '#8a93a6',
  textTransform: 'uppercase',
  fontSize: 10,
  margin: '8px 0 2px',
}

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 11,
  padding: '1px 0',
}

const groupHead: React.CSSProperties = {
  color: '#cdd3dd',
  fontWeight: 'bold',
  marginTop: 4,
  fontSize: 11,
}

// PoB source tags use a "Prefix:..." shape (Item:1:Name, Tree:nodeId, Class:Witch, Quest:..., Config, Innate, Strength).
// the prefix groups what the mod is sourced from; the rest is the specific instance.
function bucket(source: string): string {
  const colon = source.indexOf(':')
  if (colon === -1) {
    return source
  }
  return source.slice(0, colon)
}

function groupEntries(entries: Entry[]): Map<string, Entry[]> {
  const out = new Map<string, Entry[]>()
  for (const e of entries) {
    const b = bucket(e.source)
    const arr = out.get(b) ?? []
    arr.push(e)
    out.set(b, arr)
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }
  return out
}

function Section({ label, suffix, entries }: { label: string; suffix?: string; entries: Entry[] }) {
  if (entries.length === 0) {
    return null
  }
  const groups = groupEntries(entries)
  const sum = entries.reduce((acc, e) => acc + e.value, 0)
  return (
    <div>
      <div style={sectionHead}>
        {label}{' '}
        <span style={{ color: '#cdd3dd', textTransform: 'none' }}>
          ({sum}
          {suffix ?? ''})
        </span>
      </div>
      {[...groups.entries()].map(([g, arr]) => (
        <div key={g}>
          <div style={groupHead}>{g}</div>
          {arr.map((e, i) => (
            <div key={i} style={row}>
              <span style={{ opacity: 0.85 }}>{e.source.slice(g.length + 1) || g}</span>
              <span style={{ color: '#d9b45b' }}>
                {e.value}
                {suffix ?? ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ExplainStatPanel({ stat }: { stat: string }) {
  const [data, setData] = useState<Explain | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/explain-stat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stat }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const b = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(b.error ?? `explain-stat ${r.status}`)
        }
        return r.json() as Promise<Explain>
      })
      .then((d) => {
        if (!cancelled) {
          setData(d)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      cancelled = true
    }
  }, [stat])

  if (error) {
    return <div style={{ color: '#d95b5b' }}>{error}</div>
  }
  if (!data) {
    return <div style={{ opacity: 0.6 }}>loading…</div>
  }
  const hasAny = data.base.length + data.increased.length + data.more.length + data.flags.length > 0
  if (!hasAny) {
    return (
      <div style={{ opacity: 0.7, fontSize: 11 }}>
        no modDB tabulation for <code>{stat}</code>. derived stats (FullDPS, TotalEHP, etc.) are not surfaced this way.
      </div>
    )
  }
  return (
    <div>
      {data.total != null ? (
        <div style={{ marginBottom: 6 }}>
          total <span style={{ color: '#d9b45b', fontWeight: 'bold' }}>{Math.round(data.total)}</span>
        </div>
      ) : null}
      <Section label="base" entries={data.base} />
      <Section label="increased" suffix="%" entries={data.increased} />
      <Section label="more" suffix="%" entries={data.more} />
      <Section label="flags" entries={data.flags} />
    </div>
  )
}
