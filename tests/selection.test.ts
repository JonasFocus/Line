import { describe, expect, it } from 'vitest'

import {
  libraryPaneHeading,
  resolveActiveFilter,
  resolveActiveTag,
  resolveSelectionAfterDocumentsChange,
  resolveVisibleSelection,
} from '../src/selection'

describe('resolveVisibleSelection', () => {
  it('preserves the selected document while it remains visible', () => {
    expect(resolveVisibleSelection('second', ['first', 'second'])).toBe('second')
  })

  it('selects the first visible document when the current selection is hidden', () => {
    expect(resolveVisibleSelection('hidden', ['first', 'second'])).toBe('first')
  })

  it('selects the first visible document when nothing is selected', () => {
    expect(resolveVisibleSelection(null, ['first', 'second'])).toBe('first')
  })

  it('clears the selection when no documents are visible', () => {
    expect(resolveVisibleSelection('hidden', [])).toBeNull()
  })
})

describe('resolveSelectionAfterDocumentsChange', () => {
  it('preserves an open document that is absent from the filtered library list', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'draft',
      ['draft', 'other'],
      ['other'],
    )).toBe('draft')
  })

  it('preserves the open document when search or tag filters hide every match', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'open-note',
      ['open-note', 'other'],
      [],
    )).toBe('open-note')
  })

  it('keeps the open id when the filtered list is empty', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'still-open',
      ['still-open'],
      [],
    )).toBe('still-open')
  })

  it('falls back to a visible document when the selected document is removed', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'removed',
      ['first', 'second'],
      ['second'],
    )).toBe('second')
  })

  it('clears the selection when the open document is removed and nothing remains visible', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'removed',
      [],
      [],
    )).toBeNull()
  })
})

describe('resolveActiveTag', () => {
  it('keeps an active tag that still exists on a document', () => {
    expect(resolveActiveTag('draft', ['notes', 'draft'])).toBe('draft')
  })

  it('clears a ghost tag that no longer exists on any document', () => {
    expect(resolveActiveTag('gone', ['notes'])).toBeNull()
  })

  it('clears a ghost tag when the library has no tags left', () => {
    expect(resolveActiveTag('gone', [])).toBeNull()
  })

  it('leaves an unset tag filter alone', () => {
    expect(resolveActiveTag(null, ['notes'])).toBeNull()
  })
})

describe('resolveActiveFilter', () => {
  it('keeps Unlinked while session-only notes remain', () => {
    expect(resolveActiveFilter('unlinked', true)).toBe('unlinked')
  })

  it('clears Unlinked when every note gains a path', () => {
    expect(resolveActiveFilter('unlinked', false)).toBe('all')
  })

  it('leaves other filters alone', () => {
    expect(resolveActiveFilter('all', false)).toBe('all')
    expect(resolveActiveFilter('doc:abc', false)).toBe('doc:abc')
  })
})

describe('libraryPaneHeading', () => {
  it('names Unlinked when that filter is on', () => {
    expect(libraryPaneHeading('unlinked', null)).toBe('Unlinked')
  })

  it('prefers Unlinked over a concurrent tag', () => {
    expect(libraryPaneHeading('unlinked', 'draft')).toBe('Unlinked')
  })

  it('names the active tag with a hash', () => {
    expect(libraryPaneHeading('all', 'draft')).toBe('#draft')
  })

  it('falls back to Library when no Unlinked or tag filter is on', () => {
    expect(libraryPaneHeading('all', null)).toBe('Library')
  })
})
