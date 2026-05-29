import path from 'node:path'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
import { handler as loadBuild } from '../src/tools/load-build.js'

const SHIM = path.resolve('lua/pob-shim.lua')
const b = new LuaBridge(getPob2SrcDir(), SHIM)
await b.spawn()
await loadBuild(b, { pob_code_path: 'tests/test-build' })
await b.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })

const start = await b.send({
  cmd: 'search_start',
  args: {
    objective: { stat: 'FullDPS' },
    start_mode: 'current',
    population_size: 3,
    generations: 2,
    hill_climb_depth: 1,
    elitism: 1,
    seed: 1,
  },
  timeoutMs: 600_000,
})
console.log('start:', JSON.stringify(start.data))

for (;;) {
  const step = await b.send({ cmd: 'search_step', timeoutMs: 600_000 })
  const d = step.data as { done: boolean; generation: number; champion_score: number; best?: { score: number } }
  console.log(`gen ${d.generation}: champion=${d.champion_score.toFixed(0)} done=${d.done}`)
  if (d.done) {
    console.log('best:', d.best?.score.toFixed(0))
    break
  }
}
b.kill()
