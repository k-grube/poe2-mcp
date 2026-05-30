import { memo, useMemo, useRef } from 'react'
import type { TreeLayout } from './types.js'
import { nodeRadius, nodeFill, GOLD, DIM, SET1, SET2 } from './nodeStyle.js'
import { usePanZoom } from './usePanZoom.js'

const NO_MODES = new Map<number, number>()

interface Props {
  layout: TreeLayout
  championNodeIds: Set<number>
  addedNodeIds: Set<number>
  onHoverId: (id: number | null) => void
  allocModes?: Map<number, number>
}

// lit (both ends allocated) -> gold, unless both ends share a weapon set (red/green)
function edgeColor(lit: boolean, ma: number, mb: number): string {
  if (!lit) {
    return DIM
  }
  if (ma === 1 && mb === 1) {
    return SET1
  }
  if (ma === 2 && mb === 2) {
    return SET2
  }
  return GOLD
}

const BaseEdges = memo(function BaseEdges({
  layout,
  alloc,
  modes,
}: {
  layout: TreeLayout
  alloc: Set<number>
  modes: Map<number, number>
}) {
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout])
  return (
    <g>
      {layout.edges.map(([a, b], i) => {
        const na = byId.get(a)
        const nb = byId.get(b)
        if (!na || !nb) {
          return null
        }
        // hide only the bridge between the main tree and an ascendancy cluster (still
        // connected). cluster membership is the `ascendancy` field, not type -- ascendancy
        // notables are typed 'notable', so a type test would wrongly hide their edges.
        if (Boolean(na.ascendancy) !== Boolean(nb.ascendancy)) {
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
            stroke={edgeColor(lit, modes.get(a) ?? 0, modes.get(b) ?? 0)}
            strokeWidth={lit ? 18 : 10}
            opacity={lit ? 1 : 0.6}
          />
        )
      })}
    </g>
  )
})

export function TreeCanvas({ layout, championNodeIds, addedNodeIds, onHoverId, allocModes = NO_MODES }: Props) {
  const { minX, minY, maxX, maxY } = layout.bounds
  const pad = 200
  const vbW = maxX - minX + pad * 2
  const vbH = maxY - minY + pad * 2
  const vb = `${minX - pad} ${minY - pad} ${vbW} ${vbH}`
  const svgRef = useRef<SVGSVGElement>(null)
  const { transform, onMouseDown, onMouseMove, onMouseUp, endDrag } = usePanZoom(svgRef, vbW, vbH)

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={vb}
      style={{ display: 'block', background: '#0c0e12', cursor: 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        endDrag()
        onHoverId(null)
      }}
      onMouseOver={(e) => {
        const id = (e.target as Element).getAttribute?.('data-node-id')
        onHoverId(id ? Number(id) : null)
      }}
    >
      <g transform={transform}>
        <BaseEdges layout={layout} alloc={championNodeIds} modes={allocModes} />
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
              fill={nodeFill(n.type, allocated, allocModes.get(n.id) ?? 0)}
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
