// tests/lua-bridge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter, Readable, Writable } from 'node:stream';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
const mockSpawn = vi.mocked(spawn);

function makeFakeProc() {
  const proc = new EventEmitter() as any;
  proc.stdin = new Writable({ write(_c: any, _e: any, cb: any) { cb(); } });
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.kill = vi.fn();
  proc.killed = false;
  return proc;
}

const { LuaBridge } = await import('../src/lua-bridge.js');

describe('LuaBridge', () => {
  let bridge: InstanceType<typeof LuaBridge>;
  let fakeProc: any;

  beforeEach(() => {
    fakeProc = makeFakeProc();
    mockSpawn.mockReturnValue(fakeProc);
    bridge = new LuaBridge('/fake/pob2/src', '/fake/lua/pob-shim.lua');
  });

  afterEach(() => {
    bridge.kill();
  });

  it('sends JSON command and resolves with response', async () => {
    const spawnPromise = bridge.spawn();
    fakeProc.stdout.push('{"ready":true}\n');
    await spawnPromise;

    const sendPromise = bridge.send({ cmd: 'ping' });
    fakeProc.stdout.push('{"seq":1,"ok":true,"data":{"pong":true}}\n');

    const result = await sendPromise;
    expect(result).toEqual({ ok: true, data: { pong: true } });
  });

  it('rejects on error response', async () => {
    const spawnPromise = bridge.spawn();
    fakeProc.stdout.push('{"ready":true}\n');
    await spawnPromise;

    const sendPromise = bridge.send({ cmd: 'get_dps' });
    fakeProc.stdout.push('{"seq":1,"ok":false,"error":"no build loaded"}\n');

    await expect(sendPromise).rejects.toThrow('no build loaded');
  });

  it('times out if no response after 30s', async () => {
    vi.useFakeTimers();
    const spawnPromise = bridge.spawn();
    fakeProc.stdout.push('{"ready":true}\n');
    await spawnPromise;

    const sendPromise = bridge.send({ cmd: 'ping' });
    vi.advanceTimersByTime(31_000);

    await expect(sendPromise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });
});
