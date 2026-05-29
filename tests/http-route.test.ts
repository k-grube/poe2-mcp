import { describe, it, expect, vi } from 'vitest'
import type { Request } from 'express'
import type { LuaBridge } from '../src/lua-bridge.js'
import { httpRoute } from '../src/http-route.js'

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

const bridge = {} as unknown as LuaBridge

describe('httpRoute', () => {
  it('sends the op result as json', async () => {
    const handler = httpRoute(bridge, async () => ({ x: 1 }))
    const res = fakeRes()
    await handler({} as Request, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ x: 1 })
  })

  it('maps an op error to 409', async () => {
    const handler = httpRoute(bridge, async () => {
      throw new Error('no build loaded')
    })
    const res = fakeRes()
    await handler({} as Request, res as never)
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'no build loaded' })
  })

  it('maps a parseInput error to 400', async () => {
    const parseInput = () => {
      throw new Error('bad input')
    }
    const handler = httpRoute(bridge, async () => ({ x: 1 }), parseInput)
    const res = fakeRes()
    await handler({} as Request, res as never)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'bad input' })
  })

  it('passes parsed input to the op', async () => {
    const body = vi.fn().mockResolvedValue({ ok: true })
    const handler = httpRoute(bridge, body, (req) => req.body)
    const res = fakeRes()
    await handler({ body: { a: 1 } } as Request, res as never)
    expect(body).toHaveBeenCalledWith(bridge, { a: 1 })
  })
})
