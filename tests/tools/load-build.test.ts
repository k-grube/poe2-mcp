// tests/tools/load-build.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { LuaBridge } from '../../src/lua-bridge.js'
import { handler, definition } from '../../src/tools/load-build.js'
import { textOf, jsonOf } from '../helpers.js'

const mockBridge = { send: vi.fn() } as unknown as LuaBridge

describe('load_build tool', () => {
  it('definition has correct name and accepts pob_code or pob_code_path', () => {
    expect(definition.name).toBe('load_build')
    const props = definition.inputSchema.properties as Record<string, unknown>
    expect(props).toHaveProperty('pob_code')
    expect(props).toHaveProperty('pob_code_path')
  })

  it('returns build summary on success (inline)', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' },
    })
    const result = await handler(mockBridge, { pob_code: '<xml/>' })
    expect(result.content[0].type).toBe('text')
    const text = jsonOf<{ class_name: string; level: number }>(result)
    expect(text.class_name).toBe('Witch')
    expect(text.level).toBe(90)
  })

  it('loads from pob_code_path (file)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pob-test-'))
    const file = path.join(dir, 'build.xml')
    writeFileSync(file, '<xml/>')
    try {
      vi.mocked(mockBridge.send).mockResolvedValueOnce({
        ok: true,
        data: { class_name: 'Ranger', ascendancy: 'Pathfinder', level: 99, main_skill: 'Gas Arrow' },
      })
      const result = await handler(mockBridge, { pob_code_path: file })
      const text = jsonOf<{ class_name: string }>(result)
      expect(text.class_name).toBe('Ranger')
      // bridge should have received the file contents as xml
      expect(vi.mocked(mockBridge.send)).toHaveBeenCalledWith({
        cmd: 'load_build',
        args: { code: '<xml/>' },
      })
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('errors when both pob_code and pob_code_path are provided', async () => {
    const result = await handler(mockBridge, { pob_code: '<xml/>', pob_code_path: '/tmp/x' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/exactly one/)
  })

  it('errors when neither is provided', async () => {
    const result = await handler(mockBridge, {})
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/exactly one/)
  })

  it('returns error text on bridge failure', async () => {
    // pob_code starting with '<' bypasses the decode path so bridge is reached
    vi.mocked(mockBridge.send).mockRejectedValueOnce(new Error('bad xml'))
    const result = await handler(mockBridge, { pob_code: '<not-a-real-build/>' })
    expect(textOf(result)).toContain('bad xml')
    expect(result.isError).toBe(true)
  })

  it('returns decode error for malformed share code', async () => {
    const result = await handler(mockBridge, { pob_code: 'not-valid-base64-zlib' })
    expect(result.isError).toBe(true)
  })
})
