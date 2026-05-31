import type { TreeLayout, TreeNode } from './types.js'
import { nodeRadius, GOLD, DIM, SET1, SET2 } from './nodeStyle.js'

// camera maps tree space -> css px: cssX = treeX * zoom + x, cssY = treeY * zoom + y
export interface Camera {
  zoom: number
  x: number
  y: number
}

// lit (both ends allocated) -> gold, unless both ends share a weapon set (red/green)
export function edgeColor(lit: boolean, ma: number, mb: number): string {
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

// fit the tree bounds into a w x h css-px viewport (padded, centered)
export function fitCamera(bounds: TreeLayout['bounds'], w: number, h: number): Camera {
  const pad = 80
  const tw = bounds.maxX - bounds.minX || 1
  const th = bounds.maxY - bounds.minY || 1
  const zoom = Math.min((w - pad * 2) / tw, (h - pad * 2) / th)
  const x = (w - (bounds.minX + bounds.maxX) * zoom) / 2
  const y = (h - (bounds.minY + bounds.maxY) * zoom) / 2
  return { zoom, x, y }
}

// id of the node under tree-space point (tx,ty), nearest within its radius, or null
export function hitTest(nodes: TreeNode[], tx: number, ty: number): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const n of nodes) {
    const r = nodeRadius(n.type)
    const dx = n.x - tx
    const dy = n.y - ty
    const d2 = dx * dx + dy * dy
    if (d2 <= r * r && d2 < bestD) {
      bestD = d2
      best = n.id
    }
  }
  return best
}
