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

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex' }}>
      <Sidebar summary={summary} summaryError={summaryError} />
      <div style={{ flex: 1, position: 'relative' }}>
        {layout ? (
          <>
            <TreeCanvas
              layout={layout}
              championNodeIds={stream.championNodeIds}
              addedNodeIds={added}
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
