// integration test: spawns the real lua bridge against pob2/ and verifies that loading
// a poe.ninja-shaped Companion build auto-repairs the missing skillId/skillMinion +
// Beast Library entries, so per-companion DPS comes through. skipped when pob2/ isn't
// cloned yet — run `npm run setup` first.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { inflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LuaBridge } from '../../src/lua-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const POB2_SRC = path.join(ROOT, 'pob2', 'src')
const SHIM = path.join(ROOT, 'lua', 'pob-shim.lua')
const FIXTURE = path.join(ROOT, 'tests', 'test-build-minions-poeninja')

const HAS_POB2 = existsSync(path.join(POB2_SRC, 'HeadlessWrapper.lua'))
const HAS_LUAJIT = (() => {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  const r = spawnSync(cmd, ['luajit'], { stdio: 'ignore' })
  return r.status === 0
})()
const CAN_RUN = HAS_POB2 && HAS_LUAJIT

function decodePob(code: string): string {
  const std = code.trim().replace(/-/g, '+').replace(/_/g, '/')
  return inflateSync(Buffer.from(std, 'base64')).toString('utf8')
}

describe.skipIf(!CAN_RUN)('poe.ninja Companion auto-fix', () => {
  let bridge: LuaBridge

  beforeAll(async () => {
    bridge = new LuaBridge(POB2_SRC, SHIM)
    await bridge.spawn()
  }, 30_000)

  afterAll(() => {
    bridge?.kill()
  })

  it('repairs unresolved Companion gems and surfaces minion DPS', async () => {
    const xml = decodePob(readFileSync(FIXTURE, 'utf8'))

    // raw fixture is the broken poe.ninja shape: Companion gems with only nameSpec,
    // and no BeastCompanion library entries
    expect(xml).toMatch(/nameSpec="Companion: Zekoa, the Headcrusher"/)
    expect(xml).not.toMatch(/skillId="SummonBeastPlayer"/)
    expect(xml).not.toMatch(/<BeastCompanion/)

    const loadResp = await bridge.send({ cmd: 'load_build', args: { code: xml } })
    expect(loadResp.ok).toBe(true)
    const info = loadResp.data as { fixed_companions?: number; main_skill?: string }
    expect(info.fixed_companions).toBeGreaterThan(0)

    // flip all enabled groups into FullDPS so the SkillDPS array gets populated
    await bridge.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })
    const dpsResp = await bridge.send({ cmd: 'get_dps' })
    expect(dpsResp.ok).toBe(true)
    const dps = dpsResp.data as { skills?: Array<{ name: string; dps: number; skill_part?: string }> }
    const companions = (dps.skills ?? []).filter((s) => s.name.startsWith('Companion: '))
    expect(companions.length).toBeGreaterThan(0)
    // at least one of the auto-fixed companions reports non-zero DPS
    expect(companions.some((s) => s.dps > 0)).toBe(true)
  }, 60_000)
})
