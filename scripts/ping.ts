import path from 'node:path'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
const SHIM = path.resolve('lua/pob-shim.lua')
const b = new LuaBridge(getPob2SrcDir(), SHIM)
await b.spawn()
console.log('bridge ready')
const r = await b.send({ cmd: 'ping' })
console.log('ping:', JSON.stringify(r))
b.kill()
