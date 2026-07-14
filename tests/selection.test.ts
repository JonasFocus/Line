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

  it('preserves an edited document that stops matching the active filters', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'draft',
      ['draft', 'other'],
      ['other'],
    )).toBe('draft')
  })

  it('falls back to a visible document when the selected document is removed', () => {
    expect(resolveSelectionAfterDocumentsChange(
      'removed',
      ['first', 'second'],
      ['second'],
    )).toBe('second')
  })
})
