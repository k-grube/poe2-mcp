import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar.js'
import { initialState } from './useSearchStream.js'
import { gemInitialState } from './useGemSearchStream.js'
import type { BuildSummary } from './types.js'

const summary = {
  info: { class_name: 'Ranger', ascendancy: 'Deadeye', level: 97, main_skill: 'Ice Shot', weapon_sets: null },
  dps: { full_dps: 0 },
  ehp: {},
  breakpoints: {},
  tree: { points_used: 0, keystones: [], notables: [] },
  socket_groups: { groups: [], main_socket_group: 3 },
  allocated_nodes: [],
} as unknown as BuildSummary

describe('Sidebar gem section', () => {
  it('shows the gem panel and FullDPS=0 hint', () => {
    render(
      <Sidebar summary={summary} summaryError={null} stream={initialState} gem={gemInitialState} onMutate={() => {}} />,
    )
    expect(screen.getByText('gem search')).toBeTruthy()
    expect(screen.getByText(/FullDPS is 0/)).toBeTruthy()
  })
})
