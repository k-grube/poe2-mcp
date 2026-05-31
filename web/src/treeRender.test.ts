import { describe, it, expect } from 'vitest'
import { edgeColor, fitCamera, hitTest } from './treeRender.js'
import { GOLD, DIM, SET1, SET2 } from './nodeStyle.js'
import type { TreeNode } from './types.js'

describe('edgeColor', () => {
  it('dim unlit, gold lit-normal, red/green for a shared weapon set, gold for mixed', () => {
    expect(edgeColor(false, 0, 0)).toBe(DIM)
    expect(edgeColor(true, 0, 0)).toBe(GOLD)
    expect(edgeColor(true, 1, 1)).toBe(SET1)
    expect(edgeColor(true, 2, 2)).toBe(SET2)
    expect(edgeColor(true, 1, 0)).toBe(GOLD)
  })
})

describe('fitCamera', () => {
  it('centers the bounds in the viewport', () => {
    const cam = fitCamera({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 1000, 1000)
    expect(50 * cam.zoom + cam.x).toBeCloseTo(500)
    expect(50 * cam.zoom + cam.y).toBeCloseTo(500)
  })
})

describe('hitTest', () => {
  const nodes: TreeNode[] = [
    { id: 1, type: 'normal', x: 0, y: 0, name: 'a' },
    { id: 2, type: 'notable', x: 200, y: 0, name: 'b' },
  ]
  it('returns the node under the point, else null', () => {
    expect(hitTest(nodes, 0, 0)).toBe(1)
    expect(hitTest(nodes, 200, 0)).toBe(2)
    expect(hitTest(nodes, 1000, 1000)).toBeNull()
  })
})
