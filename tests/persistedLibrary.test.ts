import { describe, expect, it } from 'vitest'

import type { LineDocument } from '../src/lineDocument'
import { LIBRARY_STORAGE_KEY, loadPersistedDocuments, restorePersistedDocuments } from '../src/persistedLibrary'

const fallback: LineDocument = {
  id: 'fallback',
  title: 'Welcome to Line',
  content: '# Welcome to Line',
  folder: 'Basics',
  tags: ['welcome'],
  favorite: false,
  updatedAt: 'Jul 14, 2026',
  path: null,
  revision: null,
}

describe('restorePersistedDocuments', () => {
  it('preserves complete records while clearing filesystem paths', () => {
    const document = {
      id: 'draft',
      title: 'Draft',
      content: '# Draft\n\nBody',
      folder: 'Work',
      tags: ['planning'],
      favorite: true,
      updatedAt: 'Jul 13, 2026',
      path: '/tmp/draft.md',
      revision: 'sha256:abc',
      dirty: true,
    }

    expect(restorePersistedDocuments(JSON.stringify([document]), [fallback])).toEqual([{
      ...document,
      path: null,
    }])
  })

  it('normalizes legacy records and derives missing metadata from their content', () => {
    const restored = restorePersistedDocuments(JSON.stringify([{
      id: 'legacy',
      content: '# Recovered title\n\nKeep this draft. #important',
      path: '/Users/example/legacy.md',
      dirty: true,
    }]), [fallback])

    expect(restored).toEqual([{
      id: 'legacy',
      title: 'Recovered title',
      content: '# Recovered title\n\nKeep this draft. #important',
      folder: 'Basics',
      tags: ['important'],
      favorite: false,
      updatedAt: 'Just now',
      path: null,
      revision: null,
      dirty: true,
    }])
  })

  it('replaces unsafe optional values with usable defaults', () => {
    const restored = restorePersistedDocuments(JSON.stringify([{
      id: 'partial',
      title: 42,
      content: 'Plain text',
      folder: '',
      tags: 'not-an-array',
      favorite: 'yes',
      updatedAt: 123,
      revision: false,
      dirty: 'yes',
    }]), [fallback])

    expect(restored[0]).toMatchObject({
      title: 'Plain text',
      folder: 'Basics',
      tags: [],
      favorite: false,
      updatedAt: 'Just now',
      revision: null,
      dirty: false,
    })
  })

  it('keeps recoverable records and gives duplicate ids a safe recovery id', () => {
    const restored = restorePersistedDocuments(JSON.stringify([
      null,
      { id: '', content: 'Missing a stable id' },
      { id: 'missing-content', title: 'No content' },
      { id: 'kept', title: 'First', content: 'First copy', tags: [] },
      { id: 'kept', title: 'Duplicate', content: 'Second copy', tags: [] },
      { id: 'kept-recovered-2', title: 'Existing recovery', content: 'Third copy', tags: [] },
    ]), [fallback])

    expect(restored).toHaveLength(3)
    expect(restored[0]).toMatchObject({ id: 'kept', title: 'First', content: 'First copy' })
    expect(restored[1]).toMatchObject({ id: 'kept-recovered-3', title: 'Duplicate', content: 'Second copy' })
    expect(restored[2]).toMatchObject({ id: 'kept-recovered-2', title: 'Existing recovery', content: 'Third copy' })
  })

  it('allocates deterministic unique ids for duplicate-heavy libraries', () => {
    const collisions = Array.from({ length: 500 }, (_, index) => ({
      id: `draft-recovered-${index + 2}`,
      title: `Reserved ${index}`,
      content: `Reserved ${index}`,
      tags: [],
    }))
    const duplicates = Array.from({ length: 500 }, (_, index) => ({
      id: 'draft',
      title: `Draft ${index}`,
      content: `Draft ${index}`,
      tags: [],
    }))
    const stored = JSON.stringify([...collisions, ...duplicates])

    const firstRestore = restorePersistedDocuments(stored, [fallback])
    const secondRestore = restorePersistedDocuments(stored, [fallback])
    const ids = firstRestore.map((document) => document.id)

    expect(firstRestore).toHaveLength(1_000)
    expect(new Set(ids)).toHaveLength(1_000)
    expect(ids.slice(500, 503)).toEqual(['draft', 'draft-recovered-502', 'draft-recovered-503'])
    expect(secondRestore.map((document) => document.id)).toEqual(ids)
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-array root', JSON.stringify({ id: 'record' })],
    ['an array without recoverable records', JSON.stringify([{ title: 'No id or content' }])],
  ])('falls back for %s', (_case, stored) => {
    expect(restorePersistedDocuments(stored, [fallback])).toEqual([fallback])
  })
})

describe('loadPersistedDocuments', () => {
  it('falls back when browser storage is unavailable', () => {
    const storage = {
      getItem() {
        throw new Error('Storage access denied')
      },
    }

    expect(loadPersistedDocuments(() => storage, [fallback])).toEqual([fallback])
  })

  it('falls back when the browser storage accessor is unavailable', () => {
    expect(loadPersistedDocuments(() => {
      throw new Error('Storage accessor denied')
    }, [fallback])).toEqual([fallback])
  })

  it('reads the versioned library key', () => {
    const storage = {
      getItem(key: string) {
        expect(key).toBe(LIBRARY_STORAGE_KEY)
        return JSON.stringify([{ id: 'stored', title: 'Stored', content: 'Stored', tags: [] }])
      },
    }

    expect(loadPersistedDocuments(() => storage, [fallback])[0].id).toBe('stored')
  })
})
