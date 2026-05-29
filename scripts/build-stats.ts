import path from 'node:path'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
import { handler as loadBuild } from '../src/tools/load-build.js'

const SHIM = path.resolve('lua/pob-shim.lua')
const b = new LuaBridge(getPob2SrcDir(), SHIM)
await b.spawn()

const lr = await loadBuild(b, { pob_code_path: 'tests/test-build' })
const info = JSON.parse((lr.content[0] as { text: string }).text)

await b.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })

const dps = (await b.send({ cmd: 'get_dps' })).data as Record<string, number> & {
  skills: Array<{ name: string; dps: number; count: number }>
}
const ehp = (await b.send({ cmd: 'get_ehp' })).data as Record<string, number>
const bp = (await b.send({ cmd: 'get_breakpoints' })).data as Record<string, number | boolean>
const tree = (await b.send({ cmd: 'get_tree_summary' })).data as {
  points_used: number
  keystones: string[]
  notables: string[]
}

const f = (n: number) => Math.round(n).toLocaleString('en-US')

console.log('\n=== BUILD ===')
console.log(`${info.class_name} / ${info.ascendancy}  lvl ${info.level}  main: ${info.main_skill}`)

console.log('\n=== DPS ===')
console.log(`FullDPS:      ${f(dps.full_dps)}`)
console.log(`main group:   ${f(dps.main_dps)}  (avg hit ${f(dps.main_avg_hit)})`)
console.log(`full dot:     ${f(dps.full_dot_dps)}   main dot: ${f(dps.main_dot_dps)}   minion: ${f(dps.minion_dps)}`)
if (dps.skills?.length) {
  console.log('per-skill:')
  for (const s of dps.skills.slice(0, 8)) {
    console.log(`  ${s.name}: ${f(s.dps)}${s.count > 1 ? ` x${s.count}` : ''}`)
  }
}

console.log('\n=== EHP / defense ===')
console.log(`TotalEHP:     ${f(ehp.total_ehp)}`)
console.log(`Life ${f(ehp.life)}   ES ${f(ehp.es)}   Ward ${f(ehp.ward)}`)
console.log(`Armour ${f(ehp.armour)}   Evasion ${f(ehp.evasion)}`)
console.log(`Block ${ehp.block_chance}%   Spell suppress ${ehp.spell_suppress}%`)

console.log('\n=== resists / crit ===')
console.log(`Fire ${bp.fire_res}  Cold ${bp.cold_res}  Lightning ${bp.lightning_res}  Chaos ${bp.chaos_res}`)
console.log(`Crit ${bp.crit_chance}%${bp.crit_capped ? ' (capped)' : ''}   Hit ${bp.hit_chance}%`)

console.log('\n=== tree ===')
console.log(`${tree.points_used} points   ${tree.keystones.length} keystones, ${tree.notables.length} notables`)
console.log(`keystones: ${tree.keystones.join(', ') || '(none)'}`)

b.kill()
