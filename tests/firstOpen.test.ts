import { describe, expect, it } from 'vitest'

import {
  FIRST_OPEN_STORAGE_KEY,
  loadFirstOpen,
  nextFirstOpenSlide,
  normalizeWriterName,
  previousFirstOpenSlide,
  restoreFirstOpen,
  saveFirstOpen,
  shouldShowFirstOpen,
} from '../src/firstOpen'

describe('normalizeWriterName', () => {
  it('trims, collapses spaces, and caps length', () => {
    expect(normalizeWriterName('  Ana   Maria  ')).toBe('Ana Maria')
    expect(normalizeWriterName('x'.repeat(50)).length).toBe(40)
  })

  it('treats blank input as empty', () => {
    expect(normalizeWriterName('   \n\t')).toBe('')
  })
})

describe('restoreFirstOpen', () => {
  it('restores a completed record', () => {
    expect(restoreFirstOpen(JSON.stringify({ completed: true, name: 'Jonas' }))).toEqual({
      completed: true,
      name: 'Jonas',
    })
  })

  it('returns null for missing or garbage storage', () => {
    expect(restoreFirstOpen(null)).toBeNull()
    expect(restoreFirstOpen('{not json')).toBeNull()
    expect(restoreFirstOpen(JSON.stringify({ completed: true, name: '   ' }))).toBeNull()
    expect(restoreFirstOpen(JSON.stringify({ completed: false, name: 'Jonas' }))).toBeNull()
  })
})

describe('shouldShowFirstOpen', () => {
  it('shows only when nothing is stored', () => {
    expect(shouldShowFirstOpen(null)).toBe(true)
    expect(shouldShowFirstOpen({ completed: true, name: 'Jonas' })).toBe(false)
  })
})

describe('first-open slides', () => {
  it('walks 0-1-2 without wrapping', () => {
    expect(nextFirstOpenSlide(0)).toBe(1)
    expect(nextFirstOpenSlide(1)).toBe(2)
    expect(nextFirstOpenSlide(2)).toBe(2)
    expect(previousFirstOpenSlide(2)).toBe(1)
    expect(previousFirstOpenSlide(0)).toBe(0)
  })
})

describe('first-open storage', () => {
  it('writes a completed record and loads it back', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }

    expect(saveFirstOpen(() => storage, '  Jonas  ')).toBe(true)
    expect(store.get(FIRST_OPEN_STORAGE_KEY)).toBe(JSON.stringify({ completed: true, name: 'Jonas' }))
    expect(loadFirstOpen(() => storage)).toEqual({ completed: true, name: 'Jonas' })
  })

  it('refuses to save an empty name', () => {
    expect(saveFirstOpen(() => ({ setItem: () => undefined }), '   ')).toBe(false)
  })
})
