// scripts/smoke.ts — direct bridge integration smoke test, bypasses HTTP/MCP
// usage: tsx scripts/smoke.ts [path-to-pob-code-file]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LuaBridge } from '../src/lua-bridge.js'
import { cloneOrPull, verifyPob2, getPob2SrcDir } from '../src/pob-manager.js'
import { handler as loadBuildHandler } from '../src/tools/load-build.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHIM_PATH = path.resolve(__dirname, '..', 'lua', 'pob-shim.lua')

// minimal valid PoB2 XML for the no-arg case
const MINIMAL_XML = `<PathOfBuilding2><Build level="1" className="Witch" ascendClassName="None" targetVersion="2_0" mainSocketGroup="1" characterLevelAutoMode="true"/><Skills/><Tree activeSpec="1"><Spec title="Default" classId="2" ascendClassId="0" nodes="" activeNodes=""/></Tree><Items/></PathOfBuilding2>`

async function timed(label: string, fn: () => Promise<unknown>): Promise<void> {
  const t0 = Date.now()
  try {
    const r = await fn()
    console.log(`[${label}] ok  ${Date.now() - t0}ms`, JSON.stringify(r))
  } catch (e) {
    console.log(`[${label}] err ${Date.now() - t0}ms`, e instanceof Error ? e.message : e)
  }
}

async function main() {
  console.log('setting up pob2…')
  await cloneOrPull()
  await verifyPob2()

  const bridge = new LuaBridge(getPob2SrcDir(), SHIM_PATH)
  console.log('spawning bridge…')
  const t0 = Date.now()
  await bridge.spawn()
  console.log(`bridge ready  ${Date.now() - t0}ms`)

  await timed('ping', () => bridge.send({ cmd: 'ping' }))

  const pobCode = process.argv[2] ? readFileSync(process.argv[2], 'utf8').trim() : MINIMAL_XML

  await timed('load_build (via handler)', async () => {
    const r = await loadBuildHandler(bridge, { pob_code: pobCode })
    return JSON.parse((r.content[0] as { text: string }).text)
  })
  await timed('probe_build', () => bridge.send({ cmd: 'probe_build' }))
  await timed('get_dps', () => bridge.send({ cmd: 'get_dps' }))
  await timed('get_tree_summary', () => bridge.send({ cmd: 'get_tree_summary' }))

  bridge.kill()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
