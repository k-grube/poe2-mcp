// scripts/http-smoke.ts — e2e MCP test through HTTP
// starts the server, runs initialize -> notify -> tools/list -> load_build -> get_dps -> get_ehp
// usage: tsx scripts/http-smoke.ts [path-to-pob-code-file]
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 3001

const pobCode = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8').trim()
  : '<PathOfBuilding2><Build level="1" className="Witch" ascendClassName="None" targetVersion="2_0" mainSocketGroup="1"/><Skills/><Tree activeSpec="1"><Spec title="Default" classId="2" ascendClassId="0" nodes="" activeNodes=""/></Tree><Items/></PathOfBuilding2>'

interface HttpResp {
  status: number
  headers: Record<string, string>
  body: string
}

function post(url: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<HttpResp> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const u = new URL(url)
    const req = httpRequest(
      {
        hostname: u.hostname,
        port: Number(u.port),
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // mcp streamable http spec requires both content types
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(payload),
          ...extraHeaders,
        },
      },
      (res) => {
        const hdrs: Record<string, string> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          hdrs[k.toLowerCase()] = Array.isArray(v) ? v[0] : (v as string)
        }
        let buf = ''
        res.on('data', (d) => {
          buf += d.toString()
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: hdrs, body: buf }))
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// parse either plain json or sse-framed json body; returns first json message
function parseMcpBody(body: string, contentType?: string): unknown {
  if (contentType?.includes('text/event-stream')) {
    for (const line of body.split('\n')) {
      const m = line.match(/^data:\s*(.*)$/)
      if (m && m[1].trim()) {
        return JSON.parse(m[1])
      }
    }
    return null
  }
  return body ? JSON.parse(body) : null
}

async function step(label: string, fn: () => Promise<void>): Promise<void> {
  const t0 = Date.now()
  try {
    await fn()
    console.log(`[${label}] ok  ${Date.now() - t0}ms`)
  } catch (e) {
    console.log(`[${label}] err ${Date.now() - t0}ms`, e instanceof Error ? e.message : e)
    throw e
  }
}

async function main() {
  const serverPath = path.resolve(__dirname, '..', 'src', 'index.ts')
  console.log(`starting server on port ${PORT}…`)

  const server = spawn('npx', ['tsx', serverPath], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let ready = false
  await new Promise<void>((resolve, reject) => {
    server.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      process.stdout.write(`[server] ${s}`)
      if (s.includes('listening') && !ready) {
        ready = true
        resolve()
      }
    })
    server.stderr.on('data', (d: Buffer) => {
      const s = d.toString()
      // forward bridge logs prefixed so we can see them but distinguish source
      process.stderr.write(`[server:stderr] ${s}`)
    })
    server.on('exit', (code) => {
      if (!ready) {
        reject(new Error(`server exited ${code} before ready`))
      }
    })
  })

  const base = `http://localhost:${PORT}/mcp`
  let sessionId: string | undefined
  const auth = () => (sessionId ? { 'mcp-session-id': sessionId } : {})

  try {
    await step('initialize', async () => {
      const r = await post(base, {
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'http-smoke', version: '1.0' },
        },
      })
      sessionId = r.headers['mcp-session-id']
      console.log(`  status=${r.status} session=${sessionId?.slice(0, 8)} ct=${r.headers['content-type']}`)
      const parsed = parseMcpBody(r.body, r.headers['content-type']) as { result?: { serverInfo?: unknown } } | null
      console.log(`  serverInfo=${JSON.stringify(parsed?.result?.serverInfo)}`)
      if (r.status !== 200) {
        throw new Error(`init returned ${r.status}: ${r.body.slice(0, 200)}`)
      }
    })

    await step('notifications/initialized', async () => {
      const r = await post(base, { jsonrpc: '2.0', method: 'notifications/initialized' }, auth())
      console.log(`  status=${r.status} body_len=${r.body.length}`)
    })

    await step('tools/list', async () => {
      const r = await post(base, { jsonrpc: '2.0', method: 'tools/list', id: 2 }, auth())
      const parsed = parseMcpBody(r.body, r.headers['content-type']) as {
        result?: { tools?: Array<{ name: string }> }
      } | null
      const names = parsed?.result?.tools?.map((t) => t.name) ?? []
      console.log(`  status=${r.status} tools=${names.join(',')}`)
      if (!names.includes('load_build')) {
        throw new Error('load_build not in tools list')
      }
    })

    await step('tools/call load_build', async () => {
      const r = await post(
        base,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 3,
          params: { name: 'load_build', arguments: { pob_code: pobCode } },
        },
        auth(),
      )
      const parsed = parseMcpBody(r.body, r.headers['content-type']) as {
        result?: { content?: Array<{ text: string }>; isError?: boolean }
        error?: unknown
      } | null
      console.log(`  status=${r.status} isError=${parsed?.result?.isError}`)
      console.log(`  text=${parsed?.result?.content?.[0]?.text}`)
      if (parsed?.error) {
        throw new Error(`rpc error: ${JSON.stringify(parsed.error)}`)
      }
      if (parsed?.result?.isError) {
        throw new Error('tool reported error')
      }
    })

    await step('tools/call get_dps', async () => {
      const r = await post(
        base,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 4,
          params: { name: 'get_dps', arguments: {} },
        },
        auth(),
      )
      const parsed = parseMcpBody(r.body, r.headers['content-type']) as {
        result?: { content?: Array<{ text: string }> }
      } | null
      console.log(`  text=${parsed?.result?.content?.[0]?.text}`)
    })

    await step('tools/call get_ehp', async () => {
      const r = await post(
        base,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          id: 5,
          params: { name: 'get_ehp', arguments: {} },
        },
        auth(),
      )
      const parsed = parseMcpBody(r.body, r.headers['content-type']) as {
        result?: { content?: Array<{ text: string }> }
      } | null
      console.log(`  text=${parsed?.result?.content?.[0]?.text}`)
    })
  } finally {
    server.kill()
  }
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
