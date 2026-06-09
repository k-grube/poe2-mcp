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
          { id: null, name: 'Gas Arrow', support: false, enabled: true, level: 20, quality: 0 },
          { id: null, name: 'Deadly Poison', support: true, enabled: true, level: 20, quality: 0 },
        ],
      },
    ],
    main_socket_group: 1,
  },
  allocated_nodes: [{ id: 1, alloc_mode: 0 }],
  minion_skills: [],
}

const noop = () => {}

describe('SummaryPanel', () => {
  it('renders header, offense/defense stats, labeled resistances, skills with gem meta + dps', () => {
    const { container } = render(<SummaryPanel summary={summary} onMutate={noop} />)
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

  it('hides item/tree-granted auto socket groups and shows main-group dps for duplicate-name skills', () => {
    // mirrors test-build-minions: Wild Protector L19 in main + a tree-granted L1 dup,
    // and SkillDPS has two Wild Protector entries (main 45628, auto 14252)
    const dup: BuildSummary = {
      ...summary,
      dps: {
        full_dps: 60000,
        skills: [
          { name: 'Wild Protector', dps: 45628, count: 1 },
          { name: 'Wild Protector', dps: 14252, count: 1 },
        ],
      },
      socket_groups: {
        groups: [
          {
            index: 1,
            label: null,
            enabled: true,
            include_in_full_dps: true,
            is_main: true,
            slot: null,
            source: null,
            main_skill_name: 'Wild Protector',
            gem_count: 1,
            gems: [{ id: null, name: 'Wild Protector', support: false, enabled: true, level: 19, quality: 0 }],
          },
          {
            index: 2,
            label: null,
            enabled: true,
            include_in_full_dps: true,
            is_main: false,
            slot: null,
            source: 'Tree:62743',
            main_skill_name: 'Wild Protector',
            gem_count: 1,
            gems: [{ id: null, name: 'Wild Protector', support: false, enabled: true, level: 1, quality: 0 }],
          },
        ],
        main_socket_group: 1,
      },
    }
    const { container } = render(<SummaryPanel summary={dup} onMutate={noop} />)
    const text = container.textContent ?? ''
    expect(text).toContain('45,628') // main-group dps wins the per-name lookup
    expect(text).not.toContain('14,252') // auto-group dps would lose
    expect(text).toContain('19/0') // wild protector L19 still shown
    expect(text).not.toContain('1/0') // L1 tree-granted dup is hidden
  })
})
