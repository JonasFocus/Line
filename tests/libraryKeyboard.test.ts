import { describe, expect, it } from 'vitest'

import { resolveLibraryKeyboardTarget } from '../src/libraryKeyboard'

const visibleIds = ['first', 'second', 'third']

describe('resolveLibraryKeyboardTarget', () => {
  it('moves to the next visible document on ArrowDown', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowDown',
      selectedId: 'first',
      visibleIds,
    })).toBe('second')
  })

  it('selects the first visible document on ArrowDown when nothing is selected', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowDown',
      selectedId: null,
      visibleIds,
    })).toBe('first')
  })

  it('selects the first visible document on ArrowDown when the current id is hidden', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowDown',
      selectedId: 'hidden',
      visibleIds,
    })).toBe('first')
  })

  it('stays on the last visible document when ArrowDown would wrap', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowDown',
      selectedId: 'third',
      visibleIds,
    })).toBe('third')
  })

  it('moves to the previous visible document on ArrowUp', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowUp',
      selectedId: 'third',
      visibleIds,
    })).toBe('second')
  })

  it('selects the last visible document on ArrowUp when nothing is selected', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowUp',
      selectedId: null,
      visibleIds,
    })).toBe('third')
  })

  it('selects the last visible document on ArrowUp when the current id is hidden', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowUp',
      selectedId: 'hidden',
      visibleIds,
    })).toBe('third')
  })

  it('stays on the first visible document when ArrowUp would wrap', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowUp',
      selectedId: 'first',
      visibleIds,
    })).toBe('first')
  })

  it('jumps to the first visible document on Home', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'Home',
      selectedId: 'third',
      visibleIds,
    })).toBe('first')
    expect(resolveLibraryKeyboardTarget({
      key: 'Home',
      selectedId: null,
      visibleIds,
    })).toBe('first')
  })

  it('jumps to the last visible document on End', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'End',
      selectedId: 'first',
      visibleIds,
    })).toBe('third')
    expect(resolveLibraryKeyboardTarget({
      key: 'End',
      selectedId: null,
      visibleIds,
    })).toBe('third')
  })

  it('returns null for other keys', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowLeft',
      selectedId: 'second',
      visibleIds,
    })).toBeNull()
    expect(resolveLibraryKeyboardTarget({
      key: 'Delete',
      selectedId: 'second',
      visibleIds,
    })).toBeNull()
    expect(resolveLibraryKeyboardTarget({
      key: 'Enter',
      selectedId: 'second',
      visibleIds,
    })).toBeNull()
  })

  it('returns null when the visible list is empty', () => {
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowDown',
      selectedId: 'first',
      visibleIds: [],
    })).toBeNull()
    expect(resolveLibraryKeyboardTarget({
      key: 'ArrowUp',
      selectedId: null,
      visibleIds: [],
    })).toBeNull()
    expect(resolveLibraryKeyboardTarget({
      key: 'Home',
      selectedId: null,
      visibleIds: [],
    })).toBeNull()
    expect(resolveLibraryKeyboardTarget({
      key: 'End',
      selectedId: 'first',
      visibleIds: [],
    })).toBeNull()
  })
})
