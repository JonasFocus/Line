import { describe, expect, it } from 'vitest'

import { resolveSelectionAfterDocumentsChange, resolveVisibleSelection } from '../src/selection'

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
