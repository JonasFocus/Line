import { describe, expect, it } from 'vitest'

import { documentIsUnlinked } from '../src/lineDocument'

describe('documentIsUnlinked', () => {
  it('treats null path as unlinked', () => {
    expect(documentIsUnlinked({ path: null })).toBe(true)
  })

  it('treats empty path as unlinked', () => {
    expect(documentIsUnlinked({ path: '' })).toBe(true)
  })

  it('treats a disk path as linked', () => {
    expect(documentIsUnlinked({ path: '/Users/jonas/notes/draft.md' })).toBe(false)
  })
})
