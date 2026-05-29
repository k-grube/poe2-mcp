import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { TreeLayout } from './types.js'
import { nodeRadius, nodeFill, GOLD, DIM } from './nodeStyle.js'

// the ascendancy cluster sits far from the tree; its bridge edge spans the whole view
const isAsc = (t: string) => t === 'ascendancy' || t === 'ascend_start'

interface Props {
  layout: TreeLayout
  championNodeIds: Set<number>
  addedNodeIds: Set<number>
  onHoverId: (id: number | null) => void
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
        // hide the bridge line between the main tree and the ascendancy cluster (still connected)
        if (isAsc(na.type) !== isAsc(nb.type)) {
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

export function TreeCanvas({ layout, championNodeIds, addedNodeIds, onHoverId }: Props) {
  const { minX, minY, maxX, maxY } = layout.bounds
  const pad = 200
  const vbW = maxX - minX + pad * 2
  const vbH = maxY - minY + pad * 2
  const vb = `${minX - pad} ${minY - pad} ${vbW} ${vbH}`
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // latest view for the once-attached wheel listener to read (avoids stale closure)
  const view = useRef({ zoom, pan })
  view.current = { zoom, pan }

  // native non-passive wheel listener: react attaches onWheel as passive, so a
  // preventDefault there is a no-op and the page scrolls instead of zooming.
  // zoom anchors on the cursor: the point under the pointer stays fixed.
  useEffect(() => {
    const el = svgRef.current
    if (!el) {
      return
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ctm = el.getScreenCTM()
      if (!ctm) {
        return
      }
      const cur = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      const { zoom: z0, pan: p0 } = view.current
      const z1 = Math.min(6, Math.max(0.3, z0 * (e.deltaY < 0 ? 1.1 : 0.9)))
      const k = z1 / z0
      setZoom(z1)
      setPan({ x: cur.x - k * (cur.x - p0.x), y: cur.y - k * (cur.y - p0.y) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={vb}
      style={{ display: 'block', background: '#0c0e12', cursor: drag.current ? 'grabbing' : 'grab' }}
      onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y })}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => {
        drag.current = null
        onHoverId(null)
      }}
      onMouseOver={(e) => {
        const id = (e.target as Element).getAttribute?.('data-node-id')
        onHoverId(id ? Number(id) : null)
      }}
      onMouseMove={(e) => {
        if (!drag.current || !svgRef.current) {
          return
        }
        // mouse delta is screen px; convert to viewBox user units so pan tracks the cursor 1:1
        const rect = svgRef.current.getBoundingClientRect()
        const unitsPerPx = Math.max(vbW / rect.width, vbH / rect.height)
        setPan({
          x: drag.current.ox + (e.clientX - drag.current.x) * unitsPerPx,
          y: drag.current.oy + (e.clientY - drag.current.y) * unitsPerPx,
        })
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
