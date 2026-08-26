import { describe, expect, it } from 'vitest'

import type { LineDocument } from '../src/lineDocument'
import {
  cycleLibrarySort,
  LIBRARY_SORT_STORAGE_KEY,
  librarySortLabel,
  loadLibrarySort,
  saveLibrarySort,
  sortDocuments,
} from '../src/librarySort'

function document(partial: Partial<LineDocument> & Pick<LineDocument, 'id'>): LineDocument {
  return {
    title: partial.title ?? partial.id,
    content: '',
    folder: 'Documents',
    tags: [],
    favorite: false,
    updatedAt: 'Just now',
    path: null,
    revision: null,
    ...partial,
  }
}

describe('sortDocuments', () => {
  const alpha = document({ id: 'alpha', title: 'Alpha', updatedAtMs: 100 })
  const beta = document({ id: 'beta', title: 'Beta', updatedAtMs: 300, favorite: true })
  const gamma = document({ id: 'gamma', title: 'Gamma', updatedAtMs: 200 })
  const library = [alpha, beta, gamma]

  it('does not mutate the input list', () => {
    const original = [...library]
    const sorted = sortDocuments(library, 'recent')

    expect(sorted).not.toBe(library)
    expect(library).toEqual(original)
  })

  it('orders recent documents by updatedAtMs descending', () => {
    expect(sortDocuments(library, 'recent').map((item) => item.id)).toEqual(['beta', 'gamma', 'alpha'])
  })

  it('treats missing or non-finite updatedAtMs as oldest in recent sort', () => {
    const undated = document({ id: 'undated', title: 'Undated' })
    const invalid = document({ id: 'invalid', title: 'Invalid', updatedAtMs: Number.NaN })

    expect(sortDocuments([undated, alpha, invalid], 'recent').map((item) => item.id)).toEqual([
      'alpha',
      'undated',
      'invalid',
    ])
  })

  it('keeps original order when recent timestamps match', () => {
    const first = document({ id: 'first', title: 'First', updatedAtMs: 50 })
    const second = document({ id: 'second', title: 'Second', updatedAtMs: 50 })
    const third = document({ id: 'third', title: 'Third', updatedAtMs: 50 })

    expect(sortDocuments([first, second, third], 'recent').map((item) => item.id)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  it('sorts titles with localeCompare and treats an empty title as Untitled', () => {
    const zebra = document({ id: 'zebra', title: 'Zebra', updatedAtMs: 1 })
    const untitled = document({ id: 'empty', title: '', updatedAtMs: 2 })
    const apple = document({ id: 'apple', title: 'Apple', updatedAtMs: 3 })

    expect(sortDocuments([zebra, untitled, apple], 'title').map((item) => item.id)).toEqual([
      'apple',
      'empty',
      'zebra',
    ])
  })

  it('breaks title ties with recent order', () => {
    const older = document({ id: 'older', title: 'Note', updatedAtMs: 10 })
    const newer = document({ id: 'newer', title: 'Note', updatedAtMs: 20 })
    const empty = document({ id: 'empty', title: '', updatedAtMs: 30 })
    const untitled = document({ id: 'untitled', title: 'Untitled', updatedAtMs: 5 })

    expect(sortDocuments([older, newer, untitled, empty], 'title').map((item) => item.id)).toEqual([
      'newer',
      'older',
      'empty',
      'untitled',
    ])
  })

  it('puts starred documents first, then recent order', () => {
    const olderFavorite = document({ id: 'older-star', title: 'Older star', favorite: true, updatedAtMs: 10 })
    const newerFavorite = document({ id: 'newer-star', title: 'Newer star', favorite: true, updatedAtMs: 40 })
    const recentPlain = document({ id: 'plain', title: 'Plain', updatedAtMs: 80 })

    expect(sortDocuments([olderFavorite, recentPlain, newerFavorite], 'starred').map((item) => item.id)).toEqual([
      'newer-star',
      'older-star',
      'plain',
    ])
  })
})

describe('cycleLibrarySort', () => {
  it('cycles recent, title, and starred', () => {
    expect(cycleLibrarySort('recent')).toBe('title')
    expect(cycleLibrarySort('title')).toBe('starred')
    expect(cycleLibrarySort('starred')).toBe('recent')
  })
})

describe('librarySortLabel', () => {
  it('names the current sort for the toolbar control', () => {
    expect(librarySortLabel('recent')).toBe('Sort: Recent')
    expect(librarySortLabel('title')).toBe('Sort: Title')
    expect(librarySortLabel('starred')).toBe('Sort: Starred')
  })
})

describe('loadLibrarySort', () => {
  it('reads a stored preference from the versioned key', () => {
    const storage = {
      getItem(key: string) {
        expect(key).toBe(LIBRARY_SORT_STORAGE_KEY)
        return 'title'
      },
    }

    expect(loadLibrarySort(() => storage)).toBe('title')
  })

  it('defaults to recent when storage is missing, invalid, or unavailable', () => {
    expect(loadLibrarySort(() => ({ getItem: () => null }))).toBe('recent')
    expect(loadLibrarySort(() => ({ getItem: () => 'alpha' }))).toBe('recent')
    expect(loadLibrarySort(() => {
      throw new Error('Storage accessor denied')
    })).toBe('recent')
    expect(loadLibrarySort(() => ({
      getItem() {
        throw new Error('Storage access denied')
      },
    }))).toBe('recent')
  })
})

describe('saveLibrarySort', () => {
  it('stores the current sort on the versioned key', () => {
    let storedKey = ''
    let storedValue = ''

    expect(saveLibrarySort(() => ({
      setItem(key, value) {
        storedKey = key
        storedValue = value
      },
    }), 'starred')).toBe(true)
    expect(storedKey).toBe(LIBRARY_SORT_STORAGE_KEY)
    expect(storedValue).toBe('starred')
  })

  it('reports storage failures without throwing', () => {
    expect(saveLibrarySort(() => ({
      setItem() {
        throw new Error('quota exceeded')
      },
    }), 'recent')).toBe(false)
    expect(saveLibrarySort(() => {
      throw new Error('storage access denied')
    }, 'title')).toBe(false)
  })
})
