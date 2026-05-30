import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BuildSummary } from './types.js'
import { SummaryPanel } from './SummaryPanel.js'

const summary: BuildSummary = {
  info: { class_name: 'Ranger', ascendancy: 'Pathfinder', level: 99, main_skill: 'Ghost Dance' },
  dps: { full_dps: 1234567, skills: [{ name: 'Gas Arrow', dps: 987654, count: 1 }] },
  ehp: { total_ehp: 45678 },
  breakpoints: { fire_res: 75, cold_res: 76, lightning_res: 77, chaos_res: 30 },
  tree: { points_used: 112, keystones: ['Acrobatics'], notables: ['Heartseeker'] },
  socket_groups: {
    groups: [
      {
        index: 1,
        label: null,
        enabled: true,
        include_in_full_dps: true,
        is_main: true,
        slot: 'Weapon 1',
        source: null,
        main_skill_name: 'Gas Arrow',
        gem_count: 2,
        gems: [
          { name: 'Gas Arrow', support: false, enabled: true, level: 20, quality: 0 },
          { name: 'Deadly Poison', support: true, enabled: true, level: 20, quality: 0 },
        ],
      },
    ],
    main_socket_group: 1,
  },
}

describe('SummaryPanel', () => {
  it('renders header, a stat, the group title fallback, and gems', () => {
    render(<SummaryPanel summary={summary} />)
    expect(screen.getByText(/Ranger/)).toBeTruthy()
    expect(screen.getByText(/Ghost Dance/)).toBeTruthy()
    expect(screen.getByText('Gas Arrow')).toBeTruthy()
    expect(screen.getByText(/Deadly Poison/)).toBeTruthy()
    expect(screen.getByText(/1,234,567/)).toBeTruthy()
    expect(screen.getByText('987,654')).toBeTruthy()
  })
})
