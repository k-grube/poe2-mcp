// hits the user's npm-run-dev server at port 3000 via raw HTTP MCP protocol.
// if THIS works while claude-code MCP doesn't, the bug is in claude-code's client.
import { request as httpRequest } from 'node:http'

const PORT = 3000

function post(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = httpRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

function parseSseOrJson(body: string, ct?: string) {
  if (ct?.includes('text/event-stream')) {
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

console.log('probe 1: initialize')
const init = await post({
  jsonrpc: '2.0',
  method: 'initialize',
  id: 1,
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '1.0' } },
})
const sessionId = init.headers['mcp-session-id']
console.log(`  status=${init.status} session=${sessionId?.slice(0, 8) ?? 'none'} ct=${init.headers['content-type']}`)
console.log(`  body=${init.body.slice(0, 200)}`)

if (!sessionId) {
  console.log('NO SESSION ID, ABORTING')
  process.exit(1)
}

console.log('probe 2: notifications/initialized')
const notif = await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-session-id': sessionId })
console.log(`  status=${notif.status}`)

console.log('probe 3: tools/list (no bridge call)')
const t1 = Date.now()
const list = await post({ jsonrpc: '2.0', method: 'tools/list', id: 2 }, { 'mcp-session-id': sessionId })
console.log(`  elapsed=${Date.now() - t1}ms status=${list.status}`)
const listParsed = parseSseOrJson(list.body, list.headers['content-type'])
console.log(`  tool count=${listParsed?.result?.tools?.length ?? '?'}`)

console.log('probe 4: tools/call load_build (hits bridge)')
const t0 = Date.now()
const call = await post(
  {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 3,
    params: { name: 'load_build', arguments: { pob_code_path: 'tests/test-build' } },
  },
  { 'mcp-session-id': sessionId },
)
console.log(`  elapsed=${Date.now() - t0}ms status=${call.status}`)
const parsed = parseSseOrJson(call.body, call.headers['content-type'])
console.log(`  result=${JSON.stringify(parsed?.result?.content?.[0]?.text ?? parsed?.error)?.slice(0, 200)}`)
