import { describe, it, expect } from 'vitest'
import { diffNodeIds, nodeRadius } from './nodeStyle.js'

describe('diffNodeIds', () => {
  it('computes added and removed vs previous gen', () => {
    const prev = new Set([1, 2, 3])
    const cur = new Set([2, 3, 4, 5])
    const d = diffNodeIds(prev, cur)
    expect([...d.added].sort()).toEqual([4, 5])
    expect([...d.removed].sort()).toEqual([1])
  })
})

describe('nodeRadius', () => {
  it('sizes keystones largest and normals smallest', () => {
    expect(nodeRadius('keystone')).toBeGreaterThan(nodeRadius('notable'))
    expect(nodeRadius('notable')).toBeGreaterThan(nodeRadius('normal'))
  })
})
