import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 40

export interface PanZoom {
  transform: string
  onMouseDown: (e: ReactMouseEvent<SVGSVGElement>) => void
  onMouseMove: (e: ReactMouseEvent<SVGSVGElement>) => void
  onMouseUp: () => void
  endDrag: () => void
}

// pan/zoom for an svg viewBox: drag converts screen px -> viewBox units so it
// tracks the cursor; wheel zoom anchors on the cursor (point under it stays put).
// the wheel listener is native + non-passive because react's onWheel is passive
// (preventDefault would be a no-op and the page would scroll).
export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>, vbW: number, vbH: number): PanZoom {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // latest view for the once-attached wheel listener to read (avoids stale closure)
  const view = useRef({ zoom, pan })
  view.current = { zoom, pan }

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
      const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z0 * (e.deltaY < 0 ? 1.1 : 0.9)))
      const k = z1 / z0
      setZoom(z1)
      setPan({ x: cur.x - k * (cur.x - p0.x), y: cur.y - k * (cur.y - p0.y) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [svgRef])

  return {
    transform: `translate(${pan.x} ${pan.y}) scale(${zoom})`,
    onMouseDown: (e) => {
      drag.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y }
    },
    onMouseUp: () => {
      drag.current = null
    },
    endDrag: () => {
      drag.current = null
    },
    onMouseMove: (e) => {
      if (!drag.current || !svgRef.current) {
        return
      }
      const rect = svgRef.current.getBoundingClientRect()
      const unitsPerPx = Math.max(vbW / rect.width, vbH / rect.height)
      setPan({
        x: drag.current.ox + (e.clientX - drag.current.x) * unitsPerPx,
        y: drag.current.oy + (e.clientY - drag.current.y) * unitsPerPx,
      })
    },
  }
}
