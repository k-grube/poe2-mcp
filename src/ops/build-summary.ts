import type { ToolBody } from '../tools/define-tool.js'

// one-call build summary: aggregates the per-area lua handlers. if no build is
// loaded the first send throws "no build loaded" -> httpRoute maps to 409.
export const getBuildSummary: ToolBody = async (bridge) => {
  const info = (await bridge.send({ cmd: 'get_build_info' })).data
  // PoB defaults includeInFullDPS off, so full_dps/skills read 0; enable it across all
  // groups so the summary shows the build's real aggregate dps (matches build-stats)
  await bridge.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })
  const dps = (await bridge.send({ cmd: 'get_dps' })).data
  const ehp = (await bridge.send({ cmd: 'get_ehp' })).data
  const breakpoints = (await bridge.send({ cmd: 'get_breakpoints' })).data
  const tree = (await bridge.send({ cmd: 'get_tree_summary' })).data
  const socket_groups = (await bridge.send({ cmd: 'get_socket_groups' })).data
  const allocated = (await bridge.send({ cmd: 'get_allocated_nodes' })).data as {
    nodes?: Array<{ id: number; alloc_mode?: number }>
  }
  const allocated_nodes = (allocated?.nodes ?? []).map((n) => ({ id: n.id, alloc_mode: n.alloc_mode ?? 0 }))
  return { info, dps, ehp, breakpoints, tree, socket_groups, allocated_nodes }
}
