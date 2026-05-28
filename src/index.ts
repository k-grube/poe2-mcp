import 'dotenv/config'
import express from 'express'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { LuaBridge } from './lua-bridge.js'
import { cloneOrPull, verifyPob2, getPob2SrcDir } from './pob-manager.js'
import { toolDefinitions, dispatchTool } from './tools/registry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHIM_PATH = path.resolve(__dirname, '..', 'lua', 'pob-shim.lua')
const PORT = Number(process.env.PORT ?? 3000)

async function main() {
  console.log('poe2-mcp starting…')

  const cloneResult = await cloneOrPull()
  console.log(`pob2: ${cloneResult.action} @ ${cloneResult.head}`)
  await verifyPob2()

  const bridge = new LuaBridge(getPob2SrcDir(), SHIM_PATH)
  await bridge.spawn()
  console.log('lua bridge ready')

  function makeServer() {
    const s = new Server({ name: 'poe2-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })
    s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }))
    s.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      return dispatchTool(name, bridge, args)
    })
    return s
  }

  const app = express()
  app.use(express.json())

  // one transport+server per session — reconnects get a fresh pair rather than hitting
  // the "already initialized" 400 from a stale transport
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    process.stderr.write(
      `[http] ${req.method} session=${sessionId?.slice(0, 8) ?? 'none'} body_keys=${req.body ? Object.keys(req.body).join(',') : 'empty'}\n`,
    )

    let transport: StreamableHTTPServerTransport

    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId)!
    } else if (!sessionId) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, transport)
        },
        onsessionclosed: (id) => {
          sessions.delete(id)
        },
      })
      await makeServer().connect(transport)
    } else {
      process.stderr.write(`[http] 404 unknown session ${sessionId}\n`)
      res.status(404).json({ error: 'session not found' })
      return
    }

    process.stderr.write(`[http] -> handleRequest\n`)
    await transport.handleRequest(req, res, req.body)
    process.stderr.write(`[http] <- handleRequest done\n`)
  })

  app.listen(PORT, () => {
    console.log(`poe2-mcp listening on http://localhost:${PORT}/mcp`)
  })

  process.on('SIGINT', () => {
    bridge.kill()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('startup failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
