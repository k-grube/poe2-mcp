// src/lua-bridge.ts
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { platform } from 'node:os'
import { dbg } from './debug.js'

const DEFAULT_TIMEOUT_MS = 30_000
const LUAJIT_BIN = platform() === 'win32' ? 'luajit.exe' : 'luajit'

interface BridgeCommand {
  cmd: string
  args?: Record<string, unknown>
  timeoutMs?: number // optional per-command override
}

interface BridgeResponse {
  ok: boolean
  data?: unknown
  error?: string
}

interface Pending {
  resolve: (r: BridgeResponse) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class LuaBridge {
  private proc: ChildProcess | null = null
  private pending = new Map<number, Pending>()
  private buf = ''
  private seq = 0
  private readyResolve: (() => void) | null = null
  private readyReject: ((e: Error) => void) | null = null
  private pob2SrcDir: string
  private shimPath: string

  constructor(pob2SrcDir: string, shimPath: string) {
    this.pob2SrcDir = pob2SrcDir
    this.shimPath = shimPath
  }

  async spawn(): Promise<void> {
    const runtimeDir = path.join(this.pob2SrcDir, '..', 'runtime')
    const luaPath = [
      path.join(runtimeDir, 'lua', '?.lua').replace(/\\/g, '/'),
      path.join(runtimeDir, 'lua', '?', 'init.lua').replace(/\\/g, '/'),
    ].join(';')
    // native extensions (.so on Mac/Linux, .dll on Windows)
    const ext = platform() === 'win32' ? 'dll' : 'so'
    const luaCpath = [
      path.join(runtimeDir, `?.${ext}`).replace(/\\/g, '/'),
      path.join(runtimeDir, `loadall.${ext}`).replace(/\\/g, '/'),
    ].join(';')

    const proc = spawn(LUAJIT_BIN, [this.shimPath], {
      cwd: this.pob2SrcDir,
      shell: false,
      env: { ...process.env, LUA_PATH: luaPath, LUA_CPATH: luaCpath },
    })
    this.proc = proc

    proc.stdout!.setEncoding('utf8')
    proc.stderr!.setEncoding('utf8')

    proc.stdout!.on('data', (chunk: string) => this.onData(chunk))
    proc.stderr!.on('data', (chunk: string) => {
      process.stderr.write(`[luajit] ${chunk}`)
    })
    // any exit (clean or not) invalidates the bridge: null out the handle so
    // subsequent send() fails fast instead of writing into a dead pipe and
    // hanging until the per-cmd timeout fires. guard on proc identity: a restart
    // kills the old proc, whose exit fires async -- ignore it so it can't reject
    // or null out the replacement bridge.
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) {
        return
      }
      process.stderr.write(`[bridge] luajit exited code=${code} signal=${signal}\n`)
      this.rejectAll(new Error(`LuaJIT exited (code=${code} signal=${signal})`))
      this.proc = null
    })
    // stdin EPIPE on writes to a dead pipe: surface immediately rather than
    // silently dropping the write.
    proc.stdin!.on('error', (err) => {
      if (this.proc !== proc) {
        return
      }
      process.stderr.write(`[bridge] stdin error: ${err.message}\n`)
      this.rejectAll(new Error(`bridge stdin error: ${err.message}`))
      this.proc = null
    })

    return new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
      setTimeout(() => reject(new Error('LuaJIT ready timed out after 30s')), DEFAULT_TIMEOUT_MS)
    })
  }

  private onData(chunk: string): void {
    dbg(`[bridge:stdout raw] ${JSON.stringify(chunk).slice(0, 120)}\n`)
    this.buf += chunk
    const lines = this.buf.split('\n')
    this.buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      try {
        const msg = JSON.parse(line) as Record<string, unknown>
        if (msg.ready === true) {
          dbg('[bridge] ready signal received\n')
          this.readyResolve?.()
          this.readyResolve = null
          continue
        }
        const seq = msg.seq as number
        dbg(`[bridge] response seq=${seq} ok=${msg.ok}\n`)
        const p = this.pending.get(seq)
        if (!p) {
          dbg(`[bridge] no pending for seq=${seq}\n`)
          continue
        }
        clearTimeout(p.timer)
        this.pending.delete(seq)
        const { seq: _seq, ...rest } = msg
        const resp = rest as unknown as BridgeResponse
        if (resp.ok) {
          p.resolve(resp)
        } else {
          p.reject(new Error(resp.error ?? 'unknown error from Lua'))
        }
      } catch (e) {
        process.stderr.write(`[bridge] json parse error on line: ${JSON.stringify(line)}: ${e}\n`)
      }
    }
  }

  async send(cmd: BridgeCommand): Promise<BridgeResponse> {
    if (!this.proc || this.proc.killed) {
      throw new Error('LuaBridge: subprocess not running — call spawn() first')
    }
    const seq = ++this.seq
    const { timeoutMs, ...wire } = cmd
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS
    const payload = JSON.stringify({ seq, ...wire }) + '\n'
    dbg(`[bridge] send seq=${seq} cmd=${cmd.cmd} bytes=${payload.length} timeout=${timeout}\n`)
    return new Promise<BridgeResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq)
        process.stderr.write(`[bridge] timeout seq=${seq} cmd=${cmd.cmd}\n`)
        reject(new Error(`LuaBridge: command "${cmd.cmd}" timed out after ${timeout}ms`))
      }, timeout)
      this.pending.set(seq, { resolve, reject, timer })
      const flushed = this.proc!.stdin!.write(payload)
      dbg(`[bridge] stdin write flushed=${flushed}\n`)
    })
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
    this.readyReject?.(err)
  }

  async restart(pob2SrcDir?: string, shimPath?: string): Promise<void> {
    this.kill()
    if (pob2SrcDir) {
      this.pob2SrcDir = pob2SrcDir
    }
    if (shimPath) {
      this.shimPath = shimPath
    }
    await this.spawn()
  }

  kill(): void {
    this.rejectAll(new Error('LuaBridge: killed'))
    this.proc?.kill()
    this.proc = null
  }
}
