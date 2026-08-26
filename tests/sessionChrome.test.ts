import { describe, expect, it } from 'vitest'

import {
  loadSessionChrome,
  restoreSessionChrome,
  saveSessionChrome,
  SESSION_STORAGE_KEY,
  type SessionChrome,
} from '../src/sessionChrome'

const documentIds = ['first', 'second', 'third']

const storedChrome: SessionChrome = {
  selectedId: 'second',
  mode: 'split',
  inspectorOpen: true,
}

describe('restoreSessionChrome', () => {
  it('restores a complete chrome record', () => {
    expect(restoreSessionChrome(JSON.stringify(storedChrome), documentIds)).toEqual(storedChrome)
  })

  it('falls back when storage is missing', () => {
    expect(restoreSessionChrome(null, documentIds)).toEqual({
      selectedId: 'first',
      mode: 'edit',
      inspectorOpen: false,
    })
  })

  it('falls back when the library is empty and storage is missing', () => {
    expect(restoreSessionChrome(null, [])).toEqual({
      selectedId: null,
      mode: 'edit',
      inspectorOpen: false,
    })
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-object root', JSON.stringify(['second'])],
    ['a null root', 'null'],
  ])('falls back for %s', (_case, stored) => {
    expect(restoreSessionChrome(stored, documentIds)).toEqual({
      selectedId: 'first',
      mode: 'edit',
      inspectorOpen: false,
    })
  })

  it('falls back to edit when the stored mode is unknown', () => {
    expect(restoreSessionChrome(JSON.stringify({
      selectedId: 'second',
      mode: 'wysiwyg',
      inspectorOpen: true,
    }), documentIds)).toEqual({
      selectedId: 'second',
      mode: 'edit',
      inspectorOpen: true,
    })
  })

  it('uses the first document id when selectedId is not in the library', () => {
    expect(restoreSessionChrome(JSON.stringify({
      selectedId: 'gone',
      mode: 'preview',
      inspectorOpen: true,
    }), documentIds)).toEqual({
      selectedId: 'first',
      mode: 'preview',
      inspectorOpen: true,
    })
  })

  it('uses null when selectedId is not in an empty library', () => {
    expect(restoreSessionChrome(JSON.stringify({
      selectedId: 'gone',
      mode: 'split',
      inspectorOpen: false,
    }), [])).toEqual({
      selectedId: null,
      mode: 'split',
      inspectorOpen: false,
    })
  })
})

describe('loadSessionChrome', () => {
  it('falls back when browser storage is unavailable', () => {
    const storage = {
      getItem() {
        throw new Error('Storage access denied')
      },
    }

    expect(loadSessionChrome(() => storage, documentIds)).toEqual({
      selectedId: 'first',
      mode: 'edit',
      inspectorOpen: false,
    })
  })

  it('falls back when the browser storage accessor is unavailable', () => {
    expect(loadSessionChrome(() => {
      throw new Error('Storage accessor denied')
    }, documentIds)).toEqual({
      selectedId: 'first',
      mode: 'edit',
      inspectorOpen: false,
    })
  })

  it('reads the versioned session key', () => {
    const storage = {
      getItem(key: string) {
        expect(key).toBe(SESSION_STORAGE_KEY)
        return JSON.stringify(storedChrome)
      },
    }

    expect(loadSessionChrome(() => storage, documentIds)).toEqual(storedChrome)
  })
})

describe('saveSessionChrome', () => {
  it('stores the latest chrome under the versioned session key', () => {
    let storedKey = ''
    let storedValue = ''

    expect(saveSessionChrome(() => ({
      setItem: (key, value) => {
        storedKey = key
        storedValue = value
      },
    }), storedChrome)).toBe(true)
    expect(storedKey).toBe(SESSION_STORAGE_KEY)
    expect(JSON.parse(storedValue)).toEqual(storedChrome)
  })

  it('reports storage failures', () => {
    expect(saveSessionChrome(() => ({
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }), storedChrome)).toBe(false)
  })

  it('reports storage accessor failures', () => {
    expect(saveSessionChrome(() => {
      throw new Error('storage access denied')
    }, storedChrome)).toBe(false)
  })
})
