import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TreeCanvas } from './TreeCanvas.js'
import type { TreeLayout } from './types.js'

const layout: TreeLayout = {
  nodes: [
    { id: 1, type: 'normal', x: 0, y: 0, name: 'a' },
    { id: 2, type: 'notable', x: 100, y: 0, name: 'b' },
  ],
  edges: [[1, 2]],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
}

describe('TreeCanvas', () => {
  it('renders a canvas without crashing', () => {
    const { container } = render(
      <TreeCanvas layout={layout} championNodeIds={new Set([2])} addedNodeIds={new Set()} onHoverId={() => {}} />,
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
