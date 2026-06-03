import type { ToolBody } from '../tools/define-tool.js'
import { getActiveJob } from '../search-jobs.js'
import { setBaseline } from '../active-build.js'

// run the gem-support optimizer over the active build. snapshots the baseline first so P5
// revert restores the pre-search gem layout. blocked while a tree search owns the build.
// greedy+polish runs synchronously in lua (~tens of seconds per skill), so the bridge call
// gets a long timeout well past the 30s default.
export const gemSearch: ToolBody = async (bridge, args) => {
  const active = getActiveJob()
  if (active && active.status === 'running') {
    throw new Error('a search is running; cancel it before optimizing gems')
  }
  const { xml } = (await bridge.send({ cmd: 'save_build' })).data as { xml: string }
  setBaseline(xml)
  const resp = await bridge.send({
    cmd: 'gem_search',
    args: (args ?? {}) as Record<string, unknown>,
    timeoutMs: 300_000,
  })
  return resp.data
}
