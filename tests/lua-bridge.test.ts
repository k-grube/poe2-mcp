// tests/lua-bridge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter, Readable, Writable } from 'node:stream'
import type { ChildProcess } from 'node:child_process'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'node:child_process'
const mockSpawn = vi.mocked(spawn)

type FakeProc = EventEmitter & {
  stdin: Writable
  stdout: Readable
  stderr: Readable
  kill: () => void
  killed: boolean
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stdin = new Writable({
    write(_chunk: Buffer | string, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
      cb()
    },
  })
  proc.stdout = new Readable({ read() {} })
  proc.stderr = new Readable({ read() {} })
  proc.kill = vi.fn()
  proc.killed = false
  return proc
}

const { LuaBridge } = await import('../src/lua-bridge.js')

describe('LuaBridge', () => {
  let bridge: InstanceType<typeof LuaBridge>
  let fakeProc: FakeProc

  beforeEach(() => {
    fakeProc = makeFakeProc()
    // structural subset of ChildProcess — fine for the bridge's needs (stdin/stdout/stderr/exit/kill)
    mockSpawn.mockReturnValue(fakeProc as unknown as ChildProcess)
    bridge = new LuaBridge('/fake/pob2/src', '/fake/lua/pob-shim.lua')
  })

  afterEach(() => {
    bridge.kill()
  })

  it('sends JSON command and resolves with response', async () => {
    const spawnPromise = bridge.spawn()
    fakeProc.stdout.push('{"ready":true}\n')
    await spawnPromise

    const sendPromise = bridge.send({ cmd: 'ping' })
    fakeProc.stdout.push('{"seq":1,"ok":true,"data":{"pong":true}}\n')

    const result = await sendPromise
    expect(result).toEqual({ ok: true, data: { pong: true } })
  })

  it('rejects on error response', async () => {
    const spawnPromise = bridge.spawn()
    fakeProc.stdout.push('{"ready":true}\n')
    await spawnPromise

    const sendPromise = bridge.send({ cmd: 'get_dps' })
    fakeProc.stdout.push('{"seq":1,"ok":false,"error":"no build loaded"}\n')

    await expect(sendPromise).rejects.toThrow('no build loaded')
  })

  it('times out if no response after 30s', async () => {
    vi.useFakeTimers()
    const spawnPromise = bridge.spawn()
    fakeProc.stdout.push('{"ready":true}\n')
    await spawnPromise

    const sendPromise = bridge.send({ cmd: 'ping' })
    vi.advanceTimersByTime(31_000)

    await expect(sendPromise).rejects.toThrow('timed out')
    vi.useRealTimers()
  })
})
