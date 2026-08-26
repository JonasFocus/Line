import { describe, expect, it } from 'vitest'

import { applyEditorIndent } from '../src/editorIndent'

describe('applyEditorIndent', () => {
  it('returns null for keys other than Tab', () => {
    const state = { value: 'hello', selectionStart: 5, selectionEnd: 5 }
    expect(applyEditorIndent(state, 'Enter')).toBeNull()
    expect(applyEditorIndent(state, ' ')).toBeNull()
  })

  it('inserts two spaces at a collapsed caret', () => {
    expect(applyEditorIndent(
      { value: 'ab', selectionStart: 1, selectionEnd: 1 },
      'Tab',
    )).toEqual({
      value: 'a  b',
      selectionStart: 3,
      selectionEnd: 3,
    })
  })

  it('inserts two spaces at a caret in the middle of a line', () => {
    expect(applyEditorIndent(
      { value: '- item\n- other', selectionStart: 2, selectionEnd: 2 },
      'Tab',
    )).toEqual({
      value: '-   item\n- other',
      selectionStart: 4,
      selectionEnd: 4,
    })
  })

  it('prefixes every selected line when the selection spans lines', () => {
    expect(applyEditorIndent(
      { value: '- one\n- two\n- three', selectionStart: 0, selectionEnd: 11 },
      'Tab',
    )).toEqual({
      value: '  - one\n  - two\n- three',
      selectionStart: 0,
      selectionEnd: 15,
    })
  })

  it('keeps a multiline selection covering the same lines after indent', () => {
    expect(applyEditorIndent(
      { value: 'hello\nworld', selectionStart: 3, selectionEnd: 8 },
      'indent',
    )).toEqual({
      value: '  hello\n  world',
      selectionStart: 5,
      selectionEnd: 12,
    })
  })

  it('outdents each selected line by up to two leading spaces', () => {
    expect(applyEditorIndent(
      { value: '  - one\n  - two', selectionStart: 0, selectionEnd: 15 },
      'Tab',
      true,
    )).toEqual({
      value: '- one\n- two',
      selectionStart: 0,
      selectionEnd: 11,
    })
  })

  it('outdents the current line when the caret is in the middle', () => {
    expect(applyEditorIndent(
      { value: '  hello', selectionStart: 4, selectionEnd: 4 },
      'outdent',
    )).toEqual({
      value: 'hello',
      selectionStart: 2,
      selectionEnd: 2,
    })
  })

  it('removes a leading tab or a single leftover space', () => {
    expect(applyEditorIndent(
      { value: '\titem\n item', selectionStart: 0, selectionEnd: 11 },
      'outdent',
    )).toEqual({
      value: 'item\nitem',
      selectionStart: 0,
      selectionEnd: 9,
    })
  })

  it('leaves already-flush lines unchanged but still handles the key', () => {
    const flushCaret = { value: '- one\n- two', selectionStart: 3, selectionEnd: 3 }
    expect(applyEditorIndent(flushCaret, 'Tab', true)).toEqual(flushCaret)

    const flushSelection = { value: '- one\n- two', selectionStart: 0, selectionEnd: 11 }
    expect(applyEditorIndent(flushSelection, 'outdent')).toEqual(flushSelection)
  })

  it('outdents the leading blank line when the caret is at index 0', () => {
    const state = { value: '\n  hello', selectionStart: 0, selectionEnd: 0 }
    expect(applyEditorIndent(state, 'outdent')).toEqual(state)
  })

  it('indents a selection that includes index 0 when the file starts with a blank line', () => {
    expect(applyEditorIndent(
      { value: '\nhello', selectionStart: 0, selectionEnd: 4 },
      'Tab',
    )).toEqual({
      value: '  \n  hello',
      selectionStart: 0,
      selectionEnd: 8,
    })
  })

  it('indents a leading blank line on select-all', () => {
    expect(applyEditorIndent(
      { value: '\nhello', selectionStart: 0, selectionEnd: 6 },
      'Tab',
    )).toEqual({
      value: '  \n  hello',
      selectionStart: 0,
      selectionEnd: 10,
    })
  })
})
