import path from 'node:path'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
import { handler as loadBuild } from '../src/tools/load-build.js'

const SHIM = path.resolve('lua/pob-shim.lua')
const b = new LuaBridge(getPob2SrcDir(), SHIM)
await b.spawn()
console.log('bridge ready')

await loadBuild(b, { pob_code_path: 'tests/test-build' })
await b.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })
console.log('build loaded + fullDPS enabled')

const t0 = Date.now()
const resp = await b.send({
  cmd: 'search_tree_neighborhood',
  args: {
    objective: { stat: 'FullDPS' },
    iterations: 10,
    start_mode: 'current',
    seed: 42,
    constraints: { min: { FireResist: 75, ColdResist: 75, LightningResist: 75 } },
  },
  timeoutMs: 300_000,
})
console.log(`search done in ${Date.now() - t0}ms`)
const r = resp.data as {
  initial: { score: number }
  best: { score: number; points_used: number }
  trajectory: unknown[]
  termination_reason: string
}
console.log(`initial: ${r.initial.score}`)
console.log(`best:    ${r.best.score} (${r.best.points_used} pts)`)
console.log(`trajectory length: ${r.trajectory.length}`)
console.log(`termination: ${r.termination_reason}`)
console.log('first 3 traj entries:', JSON.stringify(r.trajectory.slice(0, 3), null, 2))

b.kill()
