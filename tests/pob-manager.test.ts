import { describe, it, expect, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ access: vi.fn(), mkdir: vi.fn() }))

const mockExecFile = vi.mocked(execFile)
const mockAccess = vi.mocked(access)

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void

// import after mocks
const { getPob2Dir, verifyPob2, needsPull } = await import('../src/pob-manager.js')

describe('getPob2Dir', () => {
  it('returns path ending in pob2', () => {
    expect(getPob2Dir()).toMatch(/pob2$/)
  })

  it('is absolute', () => {
    expect(getPob2Dir().startsWith('/')).toBe(true)
  })
})

describe('verifyPob2', () => {
  it('resolves when HeadlessWrapper.lua exists', async () => {
    mockAccess.mockResolvedValue(undefined)
    await expect(verifyPob2()).resolves.toBeUndefined()
  })

  it('throws with actionable message when missing', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    await expect(verifyPob2()).rejects.toThrow('HeadlessWrapper.lua not found')
  })
})

describe('needsPull', () => {
  it('returns true when last pull was >7 days ago', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    mockExecFile.mockImplementation((_cmd, _args, cb) => {
      const done = cb as ExecCallback
      done(null, eightDaysAgo, '')
    })
    expect(await needsPull()).toBe(true)
  })

  it('returns false when last pull was recent', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    mockExecFile.mockImplementation((_cmd, _args, cb) => {
      const done = cb as ExecCallback
      done(null, yesterday, '')
    })
    expect(await needsPull()).toBe(false)
  })

  it('returns true when git log fails (fresh clone, no commits)', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb) => {
      const done = cb as ExecCallback
      done(new Error('not a git repo'), '', '')
    })
    expect(await needsPull()).toBe(true)
  })
})
