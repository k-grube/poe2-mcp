import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { BuildSummary } from './types.js'
import { SummaryPanel } from './SummaryPanel.js'

const summary: BuildSummary = {
  info: { class_name: 'Ranger', ascendancy: 'Pathfinder', level: 99, main_skill: 'Ghost Dance' },
  dps: { full_dps: 1234567, skills: [{ name: 'Gas Arrow', dps: 987654, count: 1 }] },
  ehp: { total_ehp: 45678, life: 3000, es: 1500, armour: 100, evasion: 5000, block_chance: 25, spell_suppress: 50 },
  breakpoints: {
    fire_res: 75,
    cold_res: 76,
    lightning_res: 77,
    chaos_res: 30,
    fire_res_capped: true,
    cold_res_capped: true,
    lightning_res_capped: true,
  },
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
  allocated_nodes: [{ id: 1, alloc_mode: 0 }],
}

describe('SummaryPanel', () => {
  it('renders header, offense/defense stats, labeled resistances, skills with gem meta + dps', () => {
    const { container } = render(<SummaryPanel summary={summary} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Ranger')
    expect(text).toContain('Ghost Dance')
    expect(text).toContain('Gas Arrow')
    expect(text).toContain('Deadly Poison')
    expect(text).toContain('1,234,567') // full dps
    expect(text).toContain('987,654') // per-skill dps
    expect(text).toContain('3,000') // life
    expect(text).toContain('fire 75') // labeled resistance
    expect(text).toContain('20/0') // gem level/quality
  })
})
