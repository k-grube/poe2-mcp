import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TreeCanvas } from './TreeCanvas.js'
import type { TreeLayout } from './types.js'

const layout: TreeLayout = {
  nodes: [
    { id: 1, type: 'normal', x: 0, y: 0, name: 'a' },
    { id: 2, type: 'notable', x: 100, y: 0, name: 'b' },
    { id: 3, type: 'normal', x: 0, y: 100, name: 'c' },
  ],
  edges: [
    [1, 2],
    [1, 3],
  ],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
}

describe('TreeCanvas', () => {
  it('renders a node element per layout node and marks allocated gold', () => {
    const { container } = render(
      <TreeCanvas layout={layout} championNodeIds={new Set([2])} addedNodeIds={new Set([2])} onHoverId={() => {}} />,
    )
    const nodes = container.querySelectorAll('[data-node-id]')
    expect(nodes).toHaveLength(3)
    const allocated = container.querySelector('[data-node-id="2"]')!
    expect(allocated.getAttribute('fill')).toBe('#d9b45b')
    expect(allocated.getAttribute('data-flash')).toBe('true')
  })
})
