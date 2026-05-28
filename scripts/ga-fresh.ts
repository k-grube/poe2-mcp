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
console.log('build + fullDPS ready')

const t0 = Date.now()
const resp = await b.send({
  cmd: 'search_tree_neighborhood',
  args: {
    objective: { stat: 'FullDPS' },
    start_mode: 'fresh',
    point_budget: 130,
    population_size: 5,
    generations: 6,
    hill_climb_depth: 2,
    elitism: 1,
    seed: 42,
  },
  timeoutMs: 1_800_000,
})
console.log(`elapsed ${Date.now() - t0}ms`)

const data = resp.data as {
  initial: { score: number }
  best: { score: number; points_used: number }
  total_evals: number
  trajectory: Array<{ generation: number; best_score: number; champion_score: number; elapsed_s: number }>
}
console.log('initial:', data.initial.score)
console.log('best:   ', data.best.score, `(${data.best.points_used} pts)`)
console.log('total_evals:', data.total_evals)
console.log('trajectory:')
for (const t of data.trajectory) {
  console.log(
    `  gen ${t.generation}: best=${t.best_score.toFixed(0)} champion=${t.champion_score.toFixed(0)} @${t.elapsed_s}s`,
  )
}

b.kill()
