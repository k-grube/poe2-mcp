import { describe, it, expect, vi } from 'vitest'
import { getActiveBuild, setActiveBuild, buildEvents } from '../src/active-build.js'

const info = { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' }

describe('active-build', () => {
  it('starts null', () => {
    expect(getActiveBuild()).toBeNull()
  })

  it('stores the build and emits a build event', () => {
    const seen = vi.fn()
    buildEvents.on('build', seen)
    setActiveBuild(info)
    expect(getActiveBuild()).toEqual(info)
    expect(seen).toHaveBeenCalledWith(info)
    buildEvents.off('build', seen)
  })
})
