import { describe, expect, it } from 'vitest'

import type { LineDocument } from '../src/lineDocument'
import {
  LIBRARY_PERSIST_FAILED_MESSAGE,
  LIBRARY_STORAGE_KEY,
  loadPersistedDocuments,
  removeDocumentFromLibrary,
  removeLegacyDemoDocuments,
  restoreDocumentToLibrary,
  restorePersistedDocuments,
  savePersistedDocuments,
} from '../src/persistedLibrary'

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
      folder: 'Documents',
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
      folder: 'Documents',
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

describe('removeLegacyDemoDocuments', () => {
  it('removes the old bundled demo library without touching real documents', () => {
    const demo = { ...fallback, id: 'dark-matter-dark-energy' }
    const realDocument = { ...fallback, id: 'my-draft', title: 'My draft' }

    expect(removeLegacyDemoDocuments([demo, realDocument])).toEqual([realDocument])
  })
})

describe('removeDocumentFromLibrary', () => {
  it('removes only the matching library entry and leaves the rest intact', () => {
    const keep = { ...fallback, id: 'keep', title: 'Keep', path: '/tmp/keep.md' }
    const drop = { ...fallback, id: 'drop', title: 'Drop', path: '/tmp/drop.md' }

    expect(removeDocumentFromLibrary([keep, drop], 'drop')).toEqual([keep])
  })

  it('removing the selected id leaves the remaining documents', () => {
    const selected = { ...fallback, id: 'selected', title: 'Selected' }
    const other = { ...fallback, id: 'other', title: 'Other' }
    const third = { ...fallback, id: 'third', title: 'Third' }

    expect(removeDocumentFromLibrary([selected, other, third], 'selected')).toEqual([other, third])
  })

  it('removing the last library item yields an empty list', () => {
    const only = { ...fallback, id: 'only', title: 'Only' }

    expect(removeDocumentFromLibrary([only], 'only')).toEqual([])
  })

  it('returns the same list when the id is absent', () => {
    const documents = [{ ...fallback, id: 'only' }]

    expect(removeDocumentFromLibrary(documents, 'missing')).toEqual(documents)
  })
})

describe('restoreDocumentToLibrary', () => {
  it('re-inserts the document at the original index with the same fields', () => {
    const first = { ...fallback, id: 'first', title: 'First', path: '/tmp/first.md' }
    const middle = { ...fallback, id: 'middle', title: 'Middle', path: '/tmp/middle.md', dirty: true }
    const last = { ...fallback, id: 'last', title: 'Last' }

    expect(restoreDocumentToLibrary([first, last], middle, 1)).toEqual([first, middle, last])
  })

  it('appends when no index is given and skips when the id is already present', () => {
    const keep = { ...fallback, id: 'keep', title: 'Keep' }
    const restored = { ...fallback, id: 'restored', title: 'Restored' }

    expect(restoreDocumentToLibrary([keep], restored)).toEqual([keep, restored])
    expect(restoreDocumentToLibrary([keep, restored], { ...restored, title: 'Other' })).toEqual([keep, restored])
  })
})

describe('savePersistedDocuments', () => {
  it('stores the latest clean state without filesystem access', () => {
    let storedKey = ''
    let storedValue = ''
    const document = { ...fallback, dirty: false, path: '/tmp/note.md' }

    expect(savePersistedDocuments(() => ({
      setItem: (key, value) => {
        storedKey = key
        storedValue = value
      },
    }), [document])).toBe(true)
    expect(storedKey).toBe(LIBRARY_STORAGE_KEY)
    expect(JSON.parse(storedValue)).toEqual([{ ...document, path: null }])
  })

  it('reports storage failures so closing can fail safely', () => {
    expect(savePersistedDocuments(() => ({
      setItem: () => { throw new Error('quota exceeded') },
    }), [fallback])).toBe(false)
  })

  it('exposes the existing persist-failed banner copy for debounce and beforeunload', () => {
    expect(LIBRARY_PERSIST_FAILED_MESSAGE).toBe(
      'Line could not preserve your changes. Save them before closing.',
    )
    expect(
      savePersistedDocuments(() => ({
        setItem: () => {
          throw new Error('quota exceeded')
        },
      }), [fallback]),
    ).toBe(false)
  })

  it('reports storage accessor failures so dirty unloads remain blocked', () => {
    expect(savePersistedDocuments(() => {
      throw new Error('storage access denied')
    }, [fallback])).toBe(false)
  })
})
