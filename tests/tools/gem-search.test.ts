import { describe, it, expect } from 'vitest'
import { definition } from '../../src/tools/gem-search.js'

describe('gem_search tool', () => {
  it('is named and documented', () => {
    expect(definition.name).toBe('gem_search')
    expect((definition.description ?? '').length).toBeGreaterThan(20)
  })
})
