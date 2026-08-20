import { describe, expect, it } from 'vitest'

import { isMarkdownEditorTarget, shouldFocusLibrarySearchOnFind } from '../src/findShortcut'

function markdownEditor() {
  return {
    tagName: 'TEXTAREA',
    classList: {
      contains: (token: string) => token === 'markdown-source',
    },
  }
}

function otherTarget(tagName = 'INPUT') {
  return {
    tagName,
    classList: {
      contains: () => false,
    },
  }
}

describe('isMarkdownEditorTarget', () => {
  it('recognizes the markdown source textarea', () => {
    expect(isMarkdownEditorTarget(markdownEditor())).toBe(true)
  })

  it('rejects other fields and nullish targets', () => {
    expect(isMarkdownEditorTarget(otherTarget('TEXTAREA'))).toBe(false)
    expect(isMarkdownEditorTarget(otherTarget('INPUT'))).toBe(false)
    expect(isMarkdownEditorTarget(null)).toBe(false)
  })
})

describe('shouldFocusLibrarySearchOnFind', () => {
  it('keeps native find when the markdown editor is the event target', () => {
    expect(shouldFocusLibrarySearchOnFind(markdownEditor(), otherTarget())).toBe(false)
  })

  it('keeps native find when the markdown editor is focused', () => {
    expect(shouldFocusLibrarySearchOnFind(otherTarget(), markdownEditor())).toBe(false)
  })

  it('focuses library search when focus is elsewhere', () => {
    expect(shouldFocusLibrarySearchOnFind(otherTarget('BUTTON'), otherTarget('INPUT'))).toBe(true)
    expect(shouldFocusLibrarySearchOnFind(null, null)).toBe(true)
  })
})
