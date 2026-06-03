import type { ToolBody } from '../tools/define-tool.js'
import { getBaseline, setActiveBuild } from '../active-build.js'
import { getActiveJob } from '../search-jobs.js'
import type { BuildInfo } from '../wire-types.js'

// restore the baseline captured when the last search started (the search overwrites
// the live build with its champion). errors if no search has run on this build.
export const revertBuild: ToolBody = async (bridge) => {
  const active = getActiveJob()
  if (active && active.status === 'running') {
    throw new Error('a search is running; cancel it before reverting')
  }
  const xml = getBaseline()
  if (!xml) {
    throw new Error('nothing to revert; no search has run on this build')
  }
  const info = (await bridge.send({ cmd: 'load_build', args: { code: xml } })).data as BuildInfo
  setActiveBuild(info) // notifies viewers and clears the baseline
  return info
}
