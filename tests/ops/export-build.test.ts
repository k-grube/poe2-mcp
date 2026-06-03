import { describe, it, expect, vi } from 'vitest'
import { inflateSync } from 'node:zlib'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { exportBuild } from '../../src/ops/export-build.js'

describe('exportBuild', () => {
  it('encodes the build xml into a url-safe PoB code that decodes back', async () => {
    const xml = '<PathOfBuilding><Build level="90"/></PathOfBuilding>'
    const bridge = { send: vi.fn().mockResolvedValue({ ok: true, data: { xml } }) } as unknown as LuaBridge

    const { pob_code } = (await exportBuild(bridge, undefined)) as { pob_code: string }

    expect(bridge.send).toHaveBeenCalledWith({ cmd: 'save_build' })
    expect(pob_code).not.toMatch(/[+/]/) // url-safe
    const standard = pob_code.replace(/-/g, '+').replace(/_/g, '/')
    expect(inflateSync(Buffer.from(standard, 'base64')).toString('utf8')).toBe(xml)
  })
})
