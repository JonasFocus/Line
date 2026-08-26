import { describe, expect, it } from 'vitest'

import { markdownWrapKindFromModKey, wrapMarkdownSelection } from '../src/markdownWrap'

describe('wrapMarkdownSelection', () => {
  describe('bold', () => {
    it('wraps the selection with **', () => {
      expect(wrapMarkdownSelection({
        value: 'hello world',
        selectionStart: 0,
        selectionEnd: 5,
        kind: 'bold',
      })).toEqual({
        value: '**hello** world',
        selectionStart: 2,
        selectionEnd: 7,
      })
    })

    it('unwraps when the selection already includes ** markers', () => {
      expect(wrapMarkdownSelection({
        value: '**hello** world',
        selectionStart: 0,
        selectionEnd: 9,
        kind: 'bold',
      })).toEqual({
        value: 'hello world',
        selectionStart: 0,
        selectionEnd: 5,
      })
    })

    it('unwraps when ** already surrounds the selection', () => {
      expect(wrapMarkdownSelection({
        value: 'say **hello** now',
        selectionStart: 6,
        selectionEnd: 11,
        kind: 'bold',
      })).toEqual({
        value: 'say hello now',
        selectionStart: 4,
        selectionEnd: 9,
      })
    })

    it('inserts ** around an empty selection and places the caret inside', () => {
      expect(wrapMarkdownSelection({
        value: 'hello',
        selectionStart: 5,
        selectionEnd: 5,
        kind: 'bold',
      })).toEqual({
        value: 'hello****',
        selectionStart: 7,
        selectionEnd: 7,
      })
    })
  })

  describe('italic', () => {
    it('wraps the selection with a single *', () => {
      expect(wrapMarkdownSelection({
        value: 'hello world',
        selectionStart: 0,
        selectionEnd: 5,
        kind: 'italic',
      })).toEqual({
        value: '*hello* world',
        selectionStart: 1,
        selectionEnd: 6,
      })
    })

    it('unwraps when the selection already includes single * markers', () => {
      expect(wrapMarkdownSelection({
        value: '*hello* world',
        selectionStart: 0,
        selectionEnd: 7,
        kind: 'italic',
      })).toEqual({
        value: 'hello world',
        selectionStart: 0,
        selectionEnd: 5,
      })
    })

    it('unwraps when a single * already surrounds the selection', () => {
      expect(wrapMarkdownSelection({
        value: 'say *hello* now',
        selectionStart: 5,
        selectionEnd: 10,
        kind: 'italic',
      })).toEqual({
        value: 'say hello now',
        selectionStart: 4,
        selectionEnd: 9,
      })
    })

    it('does not unwrap ** as italic', () => {
      expect(wrapMarkdownSelection({
        value: '**hello**',
        selectionStart: 2,
        selectionEnd: 7,
        kind: 'italic',
      })).toEqual({
        value: '***hello***',
        selectionStart: 3,
        selectionEnd: 8,
      })
    })

    it('unwraps italic around bold on a second toggle', () => {
      const wrapped = wrapMarkdownSelection({
        value: '**hello**',
        selectionStart: 2,
        selectionEnd: 7,
        kind: 'italic',
      })
      expect(wrapped).toEqual({
        value: '***hello***',
        selectionStart: 3,
        selectionEnd: 8,
      })
      expect(wrapMarkdownSelection({
        value: wrapped.value,
        selectionStart: wrapped.selectionStart,
        selectionEnd: wrapped.selectionEnd,
        kind: 'italic',
      })).toEqual({
        value: '**hello**',
        selectionStart: 2,
        selectionEnd: 7,
      })
    })

    it('inserts * around an empty selection and places the caret inside', () => {
      expect(wrapMarkdownSelection({
        value: 'hello',
        selectionStart: 5,
        selectionEnd: 5,
        kind: 'italic',
      })).toEqual({
        value: 'hello**',
        selectionStart: 6,
        selectionEnd: 6,
      })
    })
  })

  describe('link', () => {
    it('wraps the selection as a link and selects the url', () => {
      expect(wrapMarkdownSelection({
        value: 'see here now',
        selectionStart: 4,
        selectionEnd: 8,
        kind: 'link',
      })).toEqual({
        value: 'see [here](https://) now',
        selectionStart: 11,
        selectionEnd: 19,
      })
    })

    it('uses text as the label when the selection is empty and selects the url', () => {
      expect(wrapMarkdownSelection({
        value: 'go ',
        selectionStart: 3,
        selectionEnd: 3,
        kind: 'link',
      })).toEqual({
        value: 'go [text](https://)',
        selectionStart: 10,
        selectionEnd: 18,
      })
    })
  })
})

describe('markdownWrapKindFromModKey', () => {
  const cmd = { altKey: false, metaKey: true, shiftKey: false }

  it('maps Cmd-B, Cmd-I, and Cmd-K', () => {
    expect(markdownWrapKindFromModKey({ ...cmd, key: 'b' })).toBe('bold')
    expect(markdownWrapKindFromModKey({ ...cmd, key: 'i' })).toBe('italic')
    expect(markdownWrapKindFromModKey({ ...cmd, key: 'k' })).toBe('link')
  })

  it('ignores Ctrl so Ctrl-K can kill to end of line', () => {
    expect(markdownWrapKindFromModKey({ altKey: false, key: 'k', metaKey: false, shiftKey: false })).toBeNull()
    expect(markdownWrapKindFromModKey({ altKey: false, key: 'b', metaKey: false, shiftKey: false })).toBeNull()
  })
})
