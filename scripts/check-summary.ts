import path from 'node:path'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
import { loadBuild } from '../src/ops/load-build.js'

const SHIM = path.resolve('lua/pob-shim.lua')
const b = new LuaBridge(getPob2SrcDir(), SHIM)
await b.spawn()

await loadBuild(b, { pob_code_path: 'tests/test-build' })

const info = (await b.send({ cmd: 'get_build_info' })).data
console.log('build_info:', JSON.stringify(info))

const sg = (await b.send({ cmd: 'get_socket_groups' })).data as {
  groups: Array<{ label: string; gems: Array<{ name: string; support: boolean }> }>
}
for (const g of sg.groups.slice(0, 3)) {
  const gems = g.gems.map((x) => `${x.name}${x.support ? '(s)' : ''}`).join(', ')
  console.log(`group "${g.label}": ${gems || '(no gems)'}`)
}

b.kill()
process.exit(0)
