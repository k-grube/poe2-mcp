import { describe, it, expect, vi } from 'vitest'
import type { LuaBridge } from '../src/lua-bridge.js'
import { createTreeLayoutHandler } from '../src/tree-layout.js'

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

describe('tree-layout route', () => {
  it('returns layout data and caches it (second call skips the bridge)', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: { nodes: [], edges: [], bounds: {} } })
    const bridge = { send } as unknown as LuaBridge
    const handler = createTreeLayoutHandler(bridge)

    const res1 = fakeRes()
    await handler({} as never, res1 as never)
    expect(res1.body).toEqual({ nodes: [], edges: [], bounds: {} })

    const res2 = fakeRes()
    await handler({} as never, res2 as never)
    expect(res2.body).toEqual({ nodes: [], edges: [], bounds: {} })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('returns 409 with an error message when the bridge reports no spec', async () => {
    const send = vi.fn().mockRejectedValue(new Error('no passive spec loaded'))
    const bridge = { send } as unknown as LuaBridge
    const handler = createTreeLayoutHandler(bridge)

    const res = fakeRes()
    await handler({} as never, res as never)
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'no passive spec loaded' })
  })
})
