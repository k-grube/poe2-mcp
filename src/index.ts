import 'dotenv/config'
import express from 'express'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { LuaBridge } from './lua-bridge.js'
import { cloneOrPull, verifyPob2, getPob2SrcDir } from './pob-manager.js'
import { toolDefinitions, dispatchTool } from './tools/registry.js'
import { searchEvents, getActiveJob } from './search-jobs.js'
import { snapshotOf, sseLine } from './sse.js'
import { createTreeLayoutHandler } from './tree-layout.js'
import { httpRoute } from './http-route.js'
import { loadBuild } from './ops/load-build.js'
import { getBuildSummary } from './ops/build-summary.js'
import { searchStart, searchCancel } from './ops/search.js'
import { exportBuild } from './ops/export-build.js'
import { revertBuild } from './ops/revert-build.js'
import { gemSearch, gemSearchStart, gemSearchCancel } from './ops/gem-search.js'
import { gemEvents } from './gem-events.js'
import { gemSnapshotOf } from './gem-snapshot.js'
import { getActiveGemJob } from './gem-search-jobs.js'
import { getActiveBuild, buildEvents, clearBaseline, getCachedSummary } from './active-build.js'
import { anySearchRunning } from './search-lock.js'
import { dbg } from './debug.js'

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

  app.get('/api/tree-layout', createTreeLayoutHandler(bridge))
  app.post(
    '/api/load-build',
    httpRoute(bridge, loadBuild, (req) => req.body),
  )
  // when a tree or gem search owns the bridge, /api/build-summary would queue behind
  // a multi-minute step. fall back to the last successful summary so a page refresh
  // mid-search still shows the build instead of hanging.
  app.get('/api/build-summary', async (req, res) => {
    if (anySearchRunning().running) {
      const cached = getCachedSummary()
      if (cached) {
        res.json(cached)
        return
      }
    }
    return httpRoute(bridge, getBuildSummary)(req, res)
  })
  app.post('/api/minion-skill', async (req, res) => {
    try {
      const { group, skill_index } = req.body as { group?: number; skill_index?: number }
      if (typeof group !== 'number' || typeof skill_index !== 'number') {
        res.status(400).json({ error: 'group and skill_index (numbers) required' })
        return
      }
      const r = await bridge.send({ cmd: 'set_minion_skill', args: { group, skill_index } })
      res.json(r.data)
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })
  app.post('/api/main-socket-group', async (req, res) => {
    try {
      const { index } = req.body as { index?: number }
      if (typeof index !== 'number') {
        res.status(400).json({ error: 'index (number) required' })
        return
      }
      const r = await bridge.send({ cmd: 'set_main_socket_group', args: { index } })
      res.json(r.data)
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })
  app.post('/api/explain-stat', async (req, res) => {
    try {
      const { stat } = req.body as { stat?: string }
      if (typeof stat !== 'string' || !stat) {
        res.status(400).json({ error: 'stat (string) required' })
        return
      }
      const r = await bridge.send({ cmd: 'explain_stat', args: { stat } })
      res.json(r.data)
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })
  app.post(
    '/api/search',
    httpRoute(bridge, searchStart, (req) => req.body),
  )
  app.post(
    '/api/search/cancel',
    httpRoute(bridge, searchCancel, (req) => req.body),
  )
  app.get('/api/export', httpRoute(bridge, exportBuild))
  app.post('/api/revert', httpRoute(bridge, revertBuild))
  app.post('/api/gem-search/apply', (_req, res) => {
    clearBaseline()
    res.json({ ok: true })
  })
  app.post(
    '/api/gem-search',
    httpRoute(bridge, gemSearch, (req) => req.body),
  )
  app.post(
    '/api/gem-search/start',
    httpRoute(bridge, gemSearchStart, (req) => req.body),
  )
  app.post(
    '/api/gem-search/cancel',
    httpRoute(bridge, gemSearchCancel, (req) => req.body),
  )

  app.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(sseLine('snapshot', snapshotOf(getActiveJob(), getActiveBuild())))
    res.write(sseLine('gem:snapshot', gemSnapshotOf(getActiveGemJob())))

    const onStart = (e: unknown) => res.write(sseLine('start', e))
    const onGen = (e: unknown) => res.write(sseLine('gen', e))
    const onEnd = (e: unknown) => res.write(sseLine('end', e))
    searchEvents.on('start', onStart)
    searchEvents.on('gen', onGen)
    searchEvents.on('end', onEnd)
    const onBuild = (e: unknown) => res.write(sseLine('build', e))
    buildEvents.on('build', onBuild)
    const onGemStart = (e: unknown) => res.write(sseLine('gem:start', e))
    const onGemProgress = (e: unknown) => res.write(sseLine('gem:progress', e))
    const onGemEnd = (e: unknown) => res.write(sseLine('gem:end', e))
    gemEvents.on('gem:start', onGemStart)
    gemEvents.on('gem:progress', onGemProgress)
    gemEvents.on('gem:end', onGemEnd)

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      searchEvents.off('start', onStart)
      searchEvents.off('gen', onGen)
      searchEvents.off('end', onEnd)
      buildEvents.off('build', onBuild)
      gemEvents.off('gem:start', onGemStart)
      gemEvents.off('gem:progress', onGemProgress)
      gemEvents.off('gem:end', onGemEnd)
    })
  })

  // one transport+server per session — reconnects get a fresh pair rather than hitting
  // the "already initialized" 400 from a stale transport
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    dbg(
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
      dbg(`[http] 404 unknown session ${sessionId}\n`)
      res.status(404).json({ error: 'session not found' })
      return
    }

    dbg(`[http] -> handleRequest\n`)
    await transport.handleRequest(req, res, req.body)
    dbg(`[http] <- handleRequest done\n`)
  })

  // viz at / (root): dev runs vite in middleware mode on this same server (hmr over
  // the shared http server); prod serves the prebuilt bundle. detect by where we
  // run from -> src/ under tsx (dev), dist/ under node (prod).
  const server = http.createServer(app)
  const isDev = path.basename(__dirname) === 'src'
  if (isDev) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, '..', 'vite.config.ts'),
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    app.use(express.static(path.resolve(__dirname, '..', 'src', 'web', 'dist')))
  }

  server.listen(PORT, () => {
    console.log(`poe2-mcp listening on http://localhost:${PORT} (viz: /, mcp: /mcp)`)
  })
  // crash loudly if the bind fails (EADDRINUSE etc) — silent failure causes
  // confusing "the server appears up but my requests hang" sessions when a
  // stale process is holding the port.
  server.on('error', (err) => {
    console.error(`server bind failed on port ${PORT}: ${err.message}`)
    bridge.kill()
    process.exit(1)
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
