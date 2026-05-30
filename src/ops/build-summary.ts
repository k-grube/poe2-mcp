import type { ToolBody } from '../tools/define-tool.js'

// one-call read-only summary: aggregates the existing per-area lua handlers. if no
// build is loaded the first send throws "no build loaded" -> httpRoute maps to 409.
export const getBuildSummary: ToolBody = async (bridge) => {
  const info = (await bridge.send({ cmd: 'get_build_info' })).data
  const dps = (await bridge.send({ cmd: 'get_dps' })).data
  const ehp = (await bridge.send({ cmd: 'get_ehp' })).data
  const breakpoints = (await bridge.send({ cmd: 'get_breakpoints' })).data
  const tree = (await bridge.send({ cmd: 'get_tree_summary' })).data
  const socket_groups = (await bridge.send({ cmd: 'get_socket_groups' })).data
  return { info, dps, ehp, breakpoints, tree, socket_groups }
}
