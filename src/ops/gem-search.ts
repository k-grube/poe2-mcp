import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { ToolBody } from '../tools/define-tool.js'
import { setBaseline } from '../active-build.js'
import { anySearchRunning } from '../search-lock.js'
import { startGemSearch, requestGemCancel } from '../gem-search-jobs.js'

// snapshot the build for Revert before a gem search mutates it
async function captureBaseline(bridge: LuaBridge): Promise<void> {
  const { xml } = (await bridge.send({ cmd: 'save_build' })).data as { xml: string }
  setBaseline(xml)
}

// synchronous one-shot (MCP/agent): runs greedy+polish to completion in one bridge call.
// can take tens of seconds per skill, hence the long timeout.
export const gemSearch: ToolBody = async (bridge, args) => {
  if (anySearchRunning().running) {
    throw new Error('a search is running; cancel it before optimizing gems')
  }
  await captureBaseline(bridge)
  const resp = await bridge.send({
    cmd: 'gem_search',
    args: (args ?? {}) as Record<string, unknown>,
    timeoutMs: 300_000,
  })
  return resp.data
}

// async: start a streamed gem search, return a job summary immediately
export const gemSearchStart: ToolBody = async (bridge, args) => {
  if (anySearchRunning().running) {
    throw new Error('a search is running; cancel it before optimizing gems')
  }
  await captureBaseline(bridge)
  const job = await startGemSearch(bridge, args)
  return { job_id: job.id, status: job.status, groups: job.groups }
}

const CancelInput = z.object({ job_id: z.string().min(1) })

export const gemSearchCancel: ToolBody = async (_bridge, args) => {
  const { job_id } = CancelInput.parse(args)
  if (!requestGemCancel(job_id)) {
    throw new Error(`unknown job_id: ${job_id}`)
  }
  return { job_id, status: 'cancel_requested' }
}
