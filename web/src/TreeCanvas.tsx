import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { TreeLayout } from './types.js'
import { nodeRadius, nodeFill } from './nodeStyle.js'
import { edgeColor, fitCamera, hitTest, type Camera } from './treeRender.js'

const MIN_ZOOM = 0.02
const MAX_ZOOM = 5
const NO_MODES = new Map<number, number>()

interface Props {
  layout: TreeLayout
  championNodeIds: Set<number>
  addedNodeIds: Set<number>
  onHoverId: (id: number | null) => void
  allocModes?: Map<number, number>
}

// canvas renderer: redraws the whole tree on pan/zoom (fast for ~4500 elements,
// unlike the per-frame SVG repaint). hover is hit-tested; the search flash is a
// drawn ring. the pure transform/hit helpers live in treeRender.ts.
export function TreeCanvas({ layout, championNodeIds, addedNodeIds, onHoverId, allocModes = NO_MODES }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cam = useRef<Camera>({ zoom: 1, x: 0, y: 0 })
  const fitted = useRef(false)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const raf = useRef(0)

  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout])

  // latest props for the imperative draw loop (avoids stale closures)
  const view = useRef({ layout, championNodeIds, addedNodeIds, allocModes, byId })
  view.current = { layout, championNodeIds, addedNodeIds, allocModes, byId }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const v = view.current
    const c = cam.current
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0c0e12'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr)
    ctx.lineCap = 'round'
    for (const [a, b] of v.layout.edges) {
      const na = v.byId.get(a)
      const nb = v.byId.get(b)
      if (!na || !nb) {
        continue
      }
      // hide the bridge between the main tree and an ascendancy cluster
      if (Boolean(na.ascendancy) !== Boolean(nb.ascendancy)) {
        continue
      }
      const lit = v.championNodeIds.has(a) && v.championNodeIds.has(b)
      ctx.strokeStyle = edgeColor(lit, v.allocModes.get(a) ?? 0, v.allocModes.get(b) ?? 0)
      ctx.lineWidth = lit ? 18 : 10
      ctx.globalAlpha = lit ? 1 : 0.6
      ctx.beginPath()
      ctx.moveTo(na.x, na.y)
      ctx.lineTo(nb.x, nb.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const n of v.layout.nodes) {
      const allocated = v.championNodeIds.has(n.id)
      const r = nodeRadius(n.type)
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = nodeFill(n.type, allocated, v.allocModes.get(n.id) ?? 0)
      ctx.fill()
      if (n.type === 'keystone') {
        ctx.lineWidth = 4
        ctx.strokeStyle = allocated ? '#fff3cf' : '#6b7280'
        ctx.stroke()
      }
      if (v.addedNodeIds.has(n.id)) {
        ctx.lineWidth = 6
        ctx.strokeStyle = '#fff3cf'
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  function requestDraw() {
    if (raf.current) {
      return
    }
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      draw()
    })
  }

  // size to parent, fit on first size, redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) {
      return
    }
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      if (!fitted.current && w > 0 && h > 0) {
        cam.current = fitCamera(view.current.layout.bounds, w, h)
        fitted.current = true
      }
      requestDraw()
    }
    resize()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // redraw when allocation / search state changes
  useEffect(() => {
    requestDraw()
  }, [layout, championNodeIds, addedNodeIds, allocModes])

  // cursor-anchored wheel zoom (native non-passive so preventDefault works)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const c = cam.current
      const tx = (cx - c.x) / c.zoom
      const ty = (cy - c.y) / c.zoom
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * (e.deltaY < 0 ? 1.1 : 0.9)))
      cam.current = { zoom: z, x: cx - tx * z, y: cy - ty * z }
      requestDraw()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e: ReactMouseEvent<HTMLCanvasElement>) {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: cam.current.x, oy: cam.current.y }
  }
  function onMouseMove(e: ReactMouseEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (d) {
      cam.current = { zoom: cam.current.zoom, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }
      requestDraw()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const c = cam.current
    const tx = (e.clientX - rect.left - c.x) / c.zoom
    const ty = (e.clientY - rect.top - c.y) / c.zoom
    onHoverId(hitTest(view.current.layout.nodes, tx, ty))
  }
  function endDrag() {
    drag.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', background: '#0c0e12', cursor: 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag()
        onHoverId(null)
      }}
    />
  )
}
