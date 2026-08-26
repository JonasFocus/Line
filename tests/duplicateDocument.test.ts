import { describe, expect, it } from 'vitest'

import { duplicateLineDocument } from '../src/duplicateDocument'
import type { LineDocument } from '../src/lineDocument'

const original: LineDocument = {
  id: 'note-original',
  title: 'Weekly notes',
  content: '# Weekly notes\n\nShip the duplicate command.',
  folder: 'Work',
  tags: ['planning', 'line'],
  favorite: true,
  updatedAt: 'Aug 12, 2026',
  path: '/Users/jonas/notes/weekly.md',
  revision: 'sha256:abc',
  dirty: false,
}

describe('duplicateLineDocument', () => {
  it('copies content, tags, and folder into a new unlinked dirty document', () => {
    const copy = duplicateLineDocument(original, 'note-copy')

    expect(copy).toEqual({
      id: 'note-copy',
      title: 'Weekly notes copy',
      content: original.content,
      folder: 'Work',
      tags: ['planning', 'line'],
      favorite: false,
      updatedAt: 'Just now',
      path: null,
      revision: null,
      dirty: true,
    })
  })

  it('uses the caller-provided id and now label', () => {
    const copy = duplicateLineDocument(original, 'custom-id', 'Aug 26, 2026')

    expect(copy.id).toBe('custom-id')
    expect(copy.updatedAt).toBe('Aug 26, 2026')
  })

  it('keeps Untitled when the original title is empty or Untitled', () => {
    expect(duplicateLineDocument({ ...original, title: '' }, 'empty').title).toBe('Untitled')
    expect(duplicateLineDocument({ ...original, title: 'Untitled' }, 'untitled').title).toBe('Untitled')
  })

  it('appends copy to a named title', () => {
    expect(duplicateLineDocument(original, 'named').title).toBe('Weekly notes copy')
  })

  it('does not share the tags array with the original', () => {
    const copy = duplicateLineDocument(original, 'isolated')
    copy.tags.push('mutated')

    expect(original.tags).toEqual(['planning', 'line'])
  })

  it('does not mutate the original document', () => {
    const snapshot = { ...original, tags: [...original.tags] }
    duplicateLineDocument(original, 'note-copy')

    expect(original).toEqual(snapshot)
  })

  it('clears the disk path and revision even when the original is linked', () => {
    const copy = duplicateLineDocument(original, 'unlinked')

    expect(copy.path).toBeNull()
    expect(copy.revision).toBeNull()
    expect(original.path).toBe('/Users/jonas/notes/weekly.md')
    expect(original.revision).toBe('sha256:abc')
  })

  it('never copies favorite or a clean save state', () => {
    const copy = duplicateLineDocument(original, 'draft')

    expect(copy.favorite).toBe(false)
    expect(copy.dirty).toBe(true)
  })
})
