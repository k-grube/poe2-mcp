import http from 'node:http'
import path from 'node:path'
import express from 'express'
import { LuaBridge } from '../src/lua-bridge.js'
import { getPob2SrcDir } from '../src/pob-manager.js'
import { handler as loadBuild } from '../src/tools/load-build.js'
import { handler as startSearch } from '../src/tools/search-start.js'
import { searchEvents, getActiveJob } from '../src/search-jobs.js'
import { snapshotOf, sseLine } from '../src/sse.js'

const SHIM = path.resolve('lua/pob-shim.lua')
const bridge = new LuaBridge(getPob2SrcDir(), SHIM)
await bridge.spawn()
await loadBuild(bridge, { pob_code_path: 'tests/test-build' })
await bridge.send({ cmd: 'set_full_dps_inclusion', args: { all_enabled: true, included: true } })

const app = express()
app.get('/events', (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
  res.write(sseLine('snapshot', snapshotOf(getActiveJob())))
  const onStart = (e: unknown) => res.write(sseLine('start', e))
  const onGen = (e: unknown) => res.write(sseLine('gen', e))
  const onEnd = (e: unknown) => res.write(sseLine('end', e))
  searchEvents.on('start', onStart)
  searchEvents.on('gen', onGen)
  searchEvents.on('end', onEnd)
  res.on('close', () => {
    searchEvents.off('start', onStart)
    searchEvents.off('gen', onGen)
    searchEvents.off('end', onEnd)
  })
})
const server = app.listen(0)
const port = (server.address() as { port: number }).port

const seen: string[] = []
let genWithNodes = 0
const req = http.get(`http://localhost:${port}/events`, (res) => {
  res.setEncoding('utf8')
  res.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event: ')) {
        seen.push(line.slice(7))
      }
      if (line.startsWith('data: ') && line.includes('champion_node_ids')) {
        const d = JSON.parse(line.slice(6))
        if (Array.isArray(d.champion_node_ids) && d.champion_node_ids.length > 0) {
          genWithNodes++
        }
      }
    }
  })
})

await startSearch(bridge, {
  objective: { stat: 'FullDPS' },
  start_mode: 'current',
  population_size: 4,
  generations: 3,
  hill_climb_depth: 1,
  seed: 7,
})

// wait for the end event
await new Promise<void>((resolve) => {
  const t = setInterval(() => {
    if (seen.includes('end')) {
      clearInterval(t)
      resolve()
    }
  }, 200)
})

console.log('events seen:', seen.join(' -> '))
console.log('gen events with champion_node_ids:', genWithNodes)
const ok =
  seen[0] === 'snapshot' && seen.includes('start') && seen.includes('gen') && seen.includes('end') && genWithNodes >= 3
console.log(ok ? 'VIZ SMOKE OK' : 'VIZ SMOKE FAILED')

req.destroy()
server.close()
bridge.kill()
process.exit(ok ? 0 : 1)
