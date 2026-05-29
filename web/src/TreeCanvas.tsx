import { memo, useMemo, useRef, useState } from 'react'
import type { TreeLayout } from './types.js'
import { nodeRadius, nodeFill, GOLD, DIM } from './nodeStyle.js'

interface Props {
  layout: TreeLayout
  championNodeIds: Set<number>
  addedNodeIds: Set<number>
}

const BaseEdges = memo(function BaseEdges({ layout, alloc }: { layout: TreeLayout; alloc: Set<number> }) {
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout])
  return (
    <g>
      {layout.edges.map(([a, b], i) => {
        const na = byId.get(a)
        const nb = byId.get(b)
        if (!na || !nb) {
          return null
        }
        const lit = alloc.has(a) && alloc.has(b)
        return (
          <line
            key={i}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke={lit ? GOLD : DIM}
            strokeWidth={lit ? 6 : 2}
            opacity={lit ? 0.9 : 0.35}
          />
        )
      })}
    </g>
  )
})

export function TreeCanvas({ layout, championNodeIds, addedNodeIds }: Props) {
  const { minX, minY, maxX, maxY } = layout.bounds
  const pad = 200
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={vb}
      style={{ display: 'block', background: '#0c0e12', cursor: drag.current ? 'grabbing' : 'grab' }}
      onWheel={(e) => setZoom((z) => Math.min(6, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 0.9))))}
      onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y })}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => (drag.current = null)}
      onMouseMove={(e) => {
        if (drag.current) {
          setPan({
            x: drag.current.ox + (e.clientX - drag.current.x),
            y: drag.current.oy + (e.clientY - drag.current.y),
          })
        }
      }}
    >
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <BaseEdges layout={layout} alloc={championNodeIds} />
        {layout.nodes.map((n) => {
          const allocated = championNodeIds.has(n.id)
          let stroke = 'none'
          if (n.type === 'keystone') {
            stroke = allocated ? '#fff3cf' : '#6b7280'
          }
          return (
            <circle
              key={n.id}
              data-node-id={n.id}
              data-flash={addedNodeIds.has(n.id) ? 'true' : 'false'}
              cx={n.x}
              cy={n.y}
              r={nodeRadius(n.type)}
              fill={nodeFill(n.type, allocated)}
              stroke={stroke}
              strokeWidth={n.type === 'keystone' ? 4 : 0}
            >
              {addedNodeIds.has(n.id) ? (
                <animate attributeName="r" from={nodeRadius(n.type) * 1.8} to={nodeRadius(n.type)} dur="0.6s" />
              ) : null}
            </circle>
          )
        })}
      </g>
    </svg>
  )
}
