import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GemDiff } from './GemDiff.js'
import type { GemSkillResult } from './types.js'

const results: GemSkillResult[] = [
  {
    group: 3,
    main_skill: 'Ice Shot',
    supports: [
      { id: 'A', name: 'Elemental Focus', kept: false },
      { id: 'B', name: 'Rakiata', kept: true },
    ],
    removed: [{ id: 'C', name: 'Fork' }],
    score: 360849,
    score_before: 235235,
  },
]

describe('GemDiff', () => {
  it('renders added, kept, removed + delta', () => {
    render(<GemDiff results={results} onMutate={() => {}} />)
    expect(screen.getByText('Elemental Focus')).toBeTruthy()
    expect(screen.getByText('Fork')).toBeTruthy()
    expect(screen.getByText(/\+53%/)).toBeTruthy()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<GemDiff results={[]} onMutate={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
