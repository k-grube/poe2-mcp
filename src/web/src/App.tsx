import { useMemo, useState } from 'react'
import type { TreeNode } from './types.js'
import { useTreeLayout } from './useTreeLayout.js'
import { useSearchStream } from './useSearchStream.js'
import { useGemSearchStream } from './useGemSearchStream.js'
import { useBuildSummary } from './useBuildSummary.js'
import { diffNodeIds } from './nodeStyle.js'
import { TreeCanvas } from './TreeCanvas.js'
import { Hud } from './Hud.js'
import { Sidebar } from './Sidebar.js'

const EMPTY = new Set<number>()

export function App() {
  const { layout } = useTreeLayout()
  const stream = useSearchStream()
  const gem = useGemSearchStream()
  const { summary, error: summaryError, refetch: refetchSummary } = useBuildSummary(stream.buildInfo)
  const [hover, setHover] = useState<TreeNode | null>(null)
  const [view, setView] = useState<'after' | 'before'>('after')
  const byId = useMemo(() => new Map((layout?.nodes ?? []).map((n) => [n.id, n])), [layout])

  // baseline = the build's allocation before the search (the summary is fetched on
  // load and stays put during a search); champion streams via sse. the diff is the
  // recommended changes: added = champion - baseline, removed = baseline - champion.
  const baselineSet = useMemo(() => new Set((summary?.allocated_nodes ?? []).map((n) => n.id)), [summary])
  const allocModes = useMemo(
    () => new Map((summary?.allocated_nodes ?? []).map((n) => [n.id, n.alloc_mode])),
    [summary],
  )
  const champion = stream.championNodeIds
  const hasResult = champion.size > 0
  const { added, removed } = useMemo(() => diffNodeIds(baselineSet, champion), [baselineSet, champion])

  const showBaseline = !hasResult || view === 'before'
  const shownNodeIds = showBaseline ? baselineSet : champion
  const ghostNodeIds = showBaseline ? EMPTY : removed
  const addedNodeIds = showBaseline ? EMPTY : added
  // champion carries its own weapon-set modes; baseline view uses the summary's
  const shownModes = showBaseline ? allocModes : stream.championModes

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex' }}>
      <Sidebar summary={summary} summaryError={summaryError} stream={stream} gem={gem} onMutate={refetchSummary} />
      <div style={{ flex: 1, position: 'relative' }}>
        {layout ? (
          <>
            <TreeCanvas
              layout={layout}
              championNodeIds={shownNodeIds}
              addedNodeIds={addedNodeIds}
              ghostNodeIds={ghostNodeIds}
              allocModes={shownModes}
              onHoverId={(id) => setHover(id === null ? null : (byId.get(id) ?? null))}
            />
            <Hud state={stream} hover={hover} />
            {hasResult ? <DiffToggle view={view} setView={setView} added={added.size} removed={removed.size} /> : null}
          </>
        ) : (
          <div style={{ color: '#cdd3dd', padding: 24, font: '14px ui-monospace, monospace' }}>
            {stream.buildInfo ? 'loading tree…' : 'load a build to begin'}
          </div>
        )}
      </div>
    </div>
  )
}

const box: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(14,18,24,0.85)',
  border: '1px solid #2a3140',
  borderRadius: 8,
  padding: '6px 10px',
  font: '12px ui-monospace, monospace',
  color: '#cdd3dd',
}

function tab(active: boolean): React.CSSProperties {
  return {
    background: active ? '#1a2230' : 'transparent',
    color: active ? '#d9b45b' : '#8a93a6',
    border: '1px solid #2a3140',
    borderRadius: 6,
    padding: '3px 10px',
    cursor: 'pointer',
    font: 'inherit',
  }
}

function DiffToggle({
  view,
  setView,
  added,
  removed,
}: {
  view: 'after' | 'before'
  setView: (v: 'after' | 'before') => void
  added: number
  removed: number
}) {
  return (
    <div style={box}>
      <button style={tab(view === 'before')} onClick={() => setView('before')}>
        before
      </button>
      <button style={tab(view === 'after')} onClick={() => setView('after')}>
        after
      </button>
      <span>
        <span style={{ color: '#5bd97a' }}>+{added}</span> / <span style={{ color: '#d95b5b' }}>-{removed}</span>
      </span>
    </div>
  )
}
