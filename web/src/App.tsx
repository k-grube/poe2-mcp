import { useMemo } from 'react'
import { useTreeLayout } from './useTreeLayout.js'
import { useSearchStream } from './useSearchStream.js'
import { diffNodeIds } from './nodeStyle.js'
import { TreeCanvas } from './TreeCanvas.js'
import { Hud } from './Hud.js'

export function App() {
  const { layout, error } = useTreeLayout()
  const stream = useSearchStream()
  const added = useMemo(
    () => diffNodeIds(stream.prevNodeIds, stream.championNodeIds).added,
    [stream.prevNodeIds, stream.championNodeIds],
  )

  if (error) {
    return (
      <div style={{ color: '#d95b5b', font: '14px ui-monospace, monospace', padding: 24 }}>
        tree layout unavailable: {error}
        <br />
        load a build on the server, then reload.
      </div>
    )
  }
  if (!layout) {
    return <div style={{ color: '#cdd3dd', padding: 24, font: '14px ui-monospace, monospace' }}>loading tree…</div>
  }
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <TreeCanvas layout={layout} championNodeIds={stream.championNodeIds} addedNodeIds={added} />
      <Hud state={stream} />
    </div>
  )
}
