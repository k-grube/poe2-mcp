// src/lua-bridge.ts
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { platform } from 'node:os';

const TIMEOUT_MS = 30_000;
const LUAJIT_BIN = platform() === 'win32' ? 'luajit.exe' : 'luajit';

interface BridgeCommand {
  cmd: string;
  args?: Record<string, unknown>;
}

interface BridgeResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface Pending {
  resolve: (r: BridgeResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class LuaBridge {
  private proc: ChildProcess | null = null;
  private pending = new Map<number, Pending>();
  private buf = '';
  private seq = 0;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;

  constructor(
    private pob2SrcDir: string,
    private shimPath: string,
  ) {}

  async spawn(): Promise<void> {
    const luaPath = [
      path.join(this.pob2SrcDir, '..', 'runtime', 'lua', '?.lua').replace(/\\/g, '/'),
      path.join(this.pob2SrcDir, '..', 'runtime', 'lua', 'sha1', 'init.lua').replace(/\\/g, '/'),
    ].join(';');

    this.proc = spawn(LUAJIT_BIN, [this.shimPath], {
      cwd: this.pob2SrcDir,
      shell: false,
      env: { ...process.env, LUA_PATH: luaPath },
    });

    this.proc.stdout!.setEncoding('utf8');
    this.proc.stderr!.setEncoding('utf8');

    this.proc.stdout!.on('data', (chunk: string) => this.onData(chunk));
    this.proc.stderr!.on('data', (chunk: string) => {
      process.stderr.write(`[luajit] ${chunk}`);
    });
    this.proc.on('exit', (code) => {
      if (code !== 0) {
        this.rejectAll(new Error(`LuaJIT exited with code ${code}`));
      }
    });

    return new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      setTimeout(() => reject(new Error('LuaJIT ready timed out after 30s')), TIMEOUT_MS);
    });
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    const lines = this.buf.split('\n');
    this.buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        if (msg.ready === true) {
          this.readyResolve?.();
          this.readyResolve = null;
          continue;
        }
        const seq = msg.seq as number;
        const p = this.pending.get(seq);
        if (!p) {
          continue;
        }
        clearTimeout(p.timer);
        this.pending.delete(seq);
        const { seq: _seq, ...rest } = msg;
        const resp = rest as BridgeResponse;
        if (resp.ok) {
          p.resolve(resp);
        } else {
          p.reject(new Error(resp.error ?? 'unknown error from Lua'));
        }
      } catch {
        // malformed line — ignore
      }
    }
  }

  async send(cmd: BridgeCommand): Promise<BridgeResponse> {
    if (!this.proc || this.proc.killed) {
      throw new Error('LuaBridge: subprocess not running — call spawn() first');
    }
    const seq = ++this.seq;
    const payload = JSON.stringify({ seq, ...cmd }) + '\n';
    return new Promise<BridgeResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`LuaBridge: command "${cmd.cmd}" timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);
      this.pending.set(seq, { resolve, reject, timer });
      this.proc!.stdin!.write(payload);
    });
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    this.readyReject?.(err);
  }

  async restart(pob2SrcDir?: string, shimPath?: string): Promise<void> {
    this.kill();
    if (pob2SrcDir) {
      this.pob2SrcDir = pob2SrcDir;
    }
    if (shimPath) {
      this.shimPath = shimPath;
    }
    await this.spawn();
  }

  kill(): void {
    this.rejectAll(new Error('LuaBridge: killed'));
    this.proc?.kill();
    this.proc = null;
  }
}
