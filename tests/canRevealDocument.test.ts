import { describe, expect, it } from 'vitest'

import { canRevealDocument } from '../src/canRevealDocument'

describe('canRevealDocument', () => {
  it('rejects missing and empty paths', () => {
    expect(canRevealDocument(null)).toBe(false)
    expect(canRevealDocument(undefined)).toBe(false)
    expect(canRevealDocument('')).toBe(false)
  })

  it('accepts a disk path', () => {
    expect(canRevealDocument('/Users/jonas/notes/draft.md')).toBe(true)
  })
})
