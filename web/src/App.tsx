import { useMemo, useState } from 'react'
import type { TreeNode } from './types.js'
import { useTreeLayout } from './useTreeLayout.js'
import { useSearchStream } from './useSearchStream.js'
import { useBuildSummary } from './useBuildSummary.js'
import { diffNodeIds } from './nodeStyle.js'
import { TreeCanvas } from './TreeCanvas.js'
import { Hud } from './Hud.js'
import { Sidebar } from './Sidebar.js'

export function App() {
  const { layout } = useTreeLayout()
  const stream = useSearchStream()
  const { summary, error: summaryError } = useBuildSummary(stream.buildInfo)
  const [hover, setHover] = useState<TreeNode | null>(null)
  const byId = useMemo(() => new Map((layout?.nodes ?? []).map((n) => [n.id, n])), [layout])
  const added = useMemo(
    () => diffNodeIds(stream.prevNodeIds, stream.championNodeIds).added,
    [stream.prevNodeIds, stream.championNodeIds],
  )
  // a running search drives the tree; otherwise show the loaded build's allocation,
  // colored by weapon set. search is normal-tree only, so no modes there.
  const searching = stream.championNodeIds.size > 0
  const shownNodeIds = useMemo(() => {
    if (searching) {
      return stream.championNodeIds
    }
    return new Set((summary?.allocated_nodes ?? []).map((n) => n.id))
  }, [searching, stream.championNodeIds, summary])
  const allocModes = useMemo(() => {
    if (searching) {
      return new Map<number, number>()
    }
    return new Map((summary?.allocated_nodes ?? []).map((n) => [n.id, n.alloc_mode]))
  }, [searching, summary])

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex' }}>
      <Sidebar summary={summary} summaryError={summaryError} />
      <div style={{ flex: 1, position: 'relative' }}>
        {layout ? (
          <>
            <TreeCanvas
              layout={layout}
              championNodeIds={shownNodeIds}
              addedNodeIds={added}
              allocModes={allocModes}
              onHoverId={(id) => setHover(id === null ? null : (byId.get(id) ?? null))}
            />
            <Hud state={stream} hover={hover} />
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
