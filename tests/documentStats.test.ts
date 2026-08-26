import { describe, expect, it } from 'vitest'

import { buildDocumentStats } from '../src/documentStats'
import { countWords, deriveHeadings, estimateReadTime } from '../src/lib'

const sample = `# Hello world

This is a short note with a few words.

## Details

More prose here.
`

describe('buildDocumentStats', () => {
  it('counts words, characters, headings, and reading time from content', () => {
    const stats = buildDocumentStats({
      content: sample,
      path: '/Users/jonas/Notes/hello.md',
      tags: ['draft', 'science'],
    })

    expect(stats.words).toBe(countWords(sample))
    expect(stats.characters).toBe(sample.length)
    expect(stats.charactersNoSpaces).toBe(sample.replace(/\s/g, '').length)
    expect(stats.readTimeMinutes).toBe(estimateReadTime(sample))
    expect(stats.headingCount).toBe(deriveHeadings(sample).length)
    expect(stats.tagCount).toBe(2)
    expect(stats.pathLabel).toBe('hello.md')
  })

  it('labels an unlinked document as Not linked', () => {
    expect(buildDocumentStats({ content: '', path: null, tags: [] }).pathLabel).toBe('Not linked')
    expect(buildDocumentStats({ content: '', path: '', tags: [] }).pathLabel).toBe('Not linked')
  })

  it('returns zeros for an empty document', () => {
    expect(buildDocumentStats({ content: '', path: null, tags: [] })).toEqual({
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      readTimeMinutes: 0,
      headingCount: 0,
      tagCount: 0,
      pathLabel: 'Not linked',
    })
  })

  it('uses the tags array rather than hashtags in content', () => {
    const stats = buildDocumentStats({
      content: 'A note about #cosmos and #science',
      path: 'note.md',
      tags: ['kept'],
    })

    expect(stats.tagCount).toBe(1)
    expect(stats.pathLabel).toBe('note.md')
  })

  it('reads the basename from posix and windows paths', () => {
    expect(buildDocumentStats({ content: '', path: '/tmp/folder/draft.md', tags: [] }).pathLabel).toBe('draft.md')
    expect(buildDocumentStats({ content: '', path: 'C:\\Notes\\draft.md', tags: [] }).pathLabel).toBe('draft.md')
  })

  it('ignores dirty when computing stats', () => {
    const clean = buildDocumentStats({ content: 'One two', path: null, tags: [] })
    const dirty = buildDocumentStats({ content: 'One two', path: null, tags: [], dirty: true })
    expect(dirty).toEqual(clean)
  })
})
