import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { BuildInfo } from './types.js'
import { useBuildSummary } from './useBuildSummary.js'

const info: BuildInfo = { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' }

function Probe({ build }: { build: BuildInfo | null }) {
  const { summary, error } = useBuildSummary(build)
  if (error) {
    return <div>err:{error}</div>
  }
  if (summary) {
    return <div>ok:{summary.info.class_name}</div>
  }
  return <div>none</div>
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useBuildSummary', () => {
  it('renders none and does not fetch when no build', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    render(<Probe build={null} />)
    expect(screen.getByText('none')).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })

  it('fetches and exposes the summary when a build is set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          info,
          dps: {},
          ehp: {},
          breakpoints: {},
          tree: { points_used: 0, keystones: [], notables: [] },
          socket_groups: { groups: [], main_socket_group: 1 },
        }),
      }),
    )
    render(<Probe build={info} />)
    await waitFor(() => expect(screen.getByText('ok:Witch')).toBeTruthy())
  })

  it('exposes an error on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }))
    render(<Probe build={info} />)
    await waitFor(() => expect(screen.getByText(/err:/).textContent).toContain('409'))
  })
})
