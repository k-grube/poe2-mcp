import { describe, it, expect, vi } from 'vitest'
import type { Request } from 'express'
import type { LuaBridge } from '../src/lua-bridge.js'
import { httpRoute } from '../src/http-route.js'
import { getBuildSummary } from '../src/ops/build-summary.js'

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
}

describe('build-summary route', () => {
  it('200s with the aggregated summary when a build is loaded', async () => {
    const send = vi.fn(async ({ cmd }: { cmd: string }) => ({ ok: true, data: { cmd } }))
    const bridge = { send } as unknown as LuaBridge
    const handler = httpRoute(bridge, getBuildSummary)
    const res = fakeRes()
    await handler({} as Request, res as never)
    expect(res.statusCode).toBe(200)
    expect((res.body as { info: { cmd: string } }).info).toEqual({ cmd: 'get_build_info' })
  })

  it('409s when no build is loaded', async () => {
    const send = vi.fn().mockRejectedValue(new Error('no build loaded'))
    const bridge = { send } as unknown as LuaBridge
    const handler = httpRoute(bridge, getBuildSummary)
    const res = fakeRes()
    await handler({} as Request, res as never)
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'no build loaded' })
  })
})
