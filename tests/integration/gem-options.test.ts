// integration test: spawns the real lua bridge against pob2/ and exercises the gem-search
// option surface against the minions fixture (a Huntress with a Skeletal Warrior Minion
// group). skipped when pob2/ isn't cloned yet -> run `npm run setup` first.
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
const FIXTURE = path.join(ROOT, 'tests', 'test-build-minions')

const HAS_POB2 = existsSync(path.join(POB2_SRC, 'HeadlessWrapper.lua'))
const HAS_LUAJIT = (() => {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(cmd, ['luajit'], { stdio: 'ignore' }).status === 0
})()
const CAN_RUN = HAS_POB2 && HAS_LUAJIT

function decodePob(code: string): string {
  const std = code.trim().replace(/-/g, '+').replace(/_/g, '/')
  return inflateSync(Buffer.from(std, 'base64')).toString('utf8')
}

// the Skeletal Warrior Minion socket group in the fixture
const SKELETAL_WARRIOR_GROUP = 4

describe.skipIf(!CAN_RUN)('gem-search options', () => {
  let bridge: LuaBridge

  beforeAll(async () => {
    bridge = new LuaBridge(POB2_SRC, SHIM)
    await bridge.spawn()
    const load = await bridge.send({ cmd: 'load_build', args: { code: decodePob(readFileSync(FIXTURE, 'utf8')) } })
    expect(load.ok).toBe(true)
  }, 30_000)

  afterAll(() => {
    bridge?.kill()
  })

  it('get_valid_supports returns a non-empty candidate pool for the main group', async () => {
    const resp = await bridge.send({ cmd: 'get_valid_supports' })
    expect(resp.ok).toBe(true)
    const data = resp.data as { group: number; supports: Array<{ id: string; name: string }> }
    expect(data.supports.length).toBeGreaterThan(0)
    // shape: each entry carries an id + name the optimizer can act on
    expect(data.supports[0]).toHaveProperty('id')
    expect(data.supports[0]).toHaveProperty('name')
  })

  it('max_supports caps the optimizer at the requested slot count', async () => {
    const resp = await bridge.send({
      cmd: 'gem_search',
      args: {
        scope: [SKELETAL_WARRIOR_GROUP],
        max_supports: 2,
        minion_skill_index: 1, // pin, skip the per-trial minion-skill iteration
        polish_generations: 1,
        polish_population: 2,
      },
      timeoutMs: 120_000,
    })
    expect(resp.ok).toBe(true)
    const data = resp.data as { results: Array<{ supports: unknown[] }> }
    expect(data.results.length).toBeGreaterThan(0)
    for (const r of data.results) {
      expect(r.supports.length).toBeLessThanOrEqual(2)
    }
  }, 120_000)

  it('set_full_dps_inclusion only rebuilds when a flag actually flips', async () => {
    const first = await bridge.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })
    expect((first.data as { included: boolean }).included).toBe(true)
    // repeating the same request flips nothing, so the expensive BuildOutput is skipped
    const second = await bridge.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })
    expect((second.data as { rebuilt: boolean }).rebuilt).toBe(false)
  }, 30_000)
})
