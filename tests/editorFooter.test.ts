import { describe, expect, it } from 'vitest'

import { footerFileLabel, formatReadTimeLabel, formatWordCountLabel } from '../src/editorFooter'

describe('formatWordCountLabel', () => {
  it('formats a locale word count', () => {
    expect(formatWordCountLabel(0)).toBe('0 words')
    expect(formatWordCountLabel(1)).toBe('1 words')
    expect(formatWordCountLabel(1234)).toBe(`${(1234).toLocaleString()} words`)
  })
})

describe('formatReadTimeLabel', () => {
  it('uses a singular label for one minute', () => {
    expect(formatReadTimeLabel(1)).toBe('1 min read')
  })

  it('uses a plural label for other minute counts', () => {
    expect(formatReadTimeLabel(2)).toBe('2 min read')
    expect(formatReadTimeLabel(12)).toBe('12 min read')
  })
})

describe('footerFileLabel', () => {
  it('returns null for unlinked paths', () => {
    expect(footerFileLabel(null)).toBe(null)
    expect(footerFileLabel(undefined)).toBe(null)
    expect(footerFileLabel('')).toBe(null)
  })

  it('returns the basename of a posix path', () => {
    expect(footerFileLabel('/Users/jonas/notes.md')).toBe('notes.md')
  })

  it('returns the basename of a windows path', () => {
    expect(footerFileLabel('C:\\Users\\jonas\\notes.md')).toBe('notes.md')
  })

  it('returns a bare filename as-is', () => {
    expect(footerFileLabel('notes.md')).toBe('notes.md')
  })
})
