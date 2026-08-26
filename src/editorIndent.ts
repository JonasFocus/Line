export type EditorIndentState = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export const EDITOR_INDENT = '  '

export function applyEditorIndent(
  state: EditorIndentState,
  key: string,
  shiftKey = false,
): EditorIndentState | null {
  const direction = indentDirectionForKey(key, shiftKey)
  if (!direction) return null
  return direction === 'outdent' ? outdentEditor(state) : indentEditor(state)
}

function indentDirectionForKey(key: string, shiftKey: boolean): 'indent' | 'outdent' | null {
  if (key === 'outdent') return 'outdent'
  if (key === 'indent') return 'indent'
  if (key !== 'Tab') return null
  return shiftKey ? 'outdent' : 'indent'
}

function indentEditor(state: EditorIndentState): EditorIndentState {
  const { value, selectionStart, selectionEnd } = state
  if (selectionStart === selectionEnd) {
    const caret = clampIndex(value, selectionStart)
    const nextValue = value.slice(0, caret) + EDITOR_INDENT + value.slice(caret)
    const nextCaret = caret + EDITOR_INDENT.length
    return { value: nextValue, selectionStart: nextCaret, selectionEnd: nextCaret }
  }

  return transformSelectedLines(state, indentLine)
}

function outdentEditor(state: EditorIndentState): EditorIndentState {
  return transformSelectedLines(state, outdentLine)
}

function indentLine(line: string): { text: string; deltaAtStart: number } {
  return { text: EDITOR_INDENT + line, deltaAtStart: EDITOR_INDENT.length }
}

function outdentLine(line: string): { text: string; deltaAtStart: number } {
  if (line.startsWith('\t')) {
    return { text: line.slice(1), deltaAtStart: -1 }
  }

  let removed = 0
  while (removed < EDITOR_INDENT.length && line[removed] === ' ') {
    removed += 1
  }
  if (removed === 0) return { text: line, deltaAtStart: 0 }
  return { text: line.slice(removed), deltaAtStart: -removed }
}

function transformSelectedLines(
  state: EditorIndentState,
  transform: (line: string) => { text: string; deltaAtStart: number },
): EditorIndentState {
  const { value, selectionStart, selectionEnd } = state
  const block = selectedBlockRange(value, selectionStart, selectionEnd)
  const lines = value.slice(block.start, block.end).split('\n')
  const nextLines: string[] = []
  let originalOffset = block.start
  let nextStart = selectionStart
  let nextEnd = selectionEnd

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const { text, deltaAtStart } = transform(line)
    nextLines.push(text)
    nextStart = shiftIndex(nextStart, originalOffset, deltaAtStart)
    nextEnd = shiftIndex(nextEnd, originalOffset, deltaAtStart)
    originalOffset += line.length
    if (index < lines.length - 1) originalOffset += 1
  }

  return {
    value: value.slice(0, block.start) + nextLines.join('\n') + value.slice(block.end),
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  }
}

function selectedBlockRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { start: number; end: number } {
  const lo = clampIndex(value, Math.min(selectionStart, selectionEnd))
  let hi = clampIndex(value, Math.max(selectionStart, selectionEnd))
  if (hi > lo && value[hi - 1] === '\n') {
    hi -= 1
  }
  return {
    start: lineStartIndex(value, lo),
    end: lineEndIndex(value, hi),
  }
}

function lineStartIndex(value: string, index: number): number {
  const from = value.lastIndexOf('\n', clampIndex(value, index) - 1)
  return from === -1 ? 0 : from + 1
}

function lineEndIndex(value: string, index: number): number {
  const from = value.indexOf('\n', clampIndex(value, index))
  return from === -1 ? value.length : from
}

function shiftIndex(index: number, changeAt: number, delta: number): number {
  if (delta === 0) return index
  if (delta > 0) return index > changeAt ? index + delta : index

  const deleteEnd = changeAt - delta
  if (index <= changeAt) return index
  if (index >= deleteEnd) return index + delta
  return changeAt
}

function clampIndex(value: string, index: number): number {
  if (index < 0) return 0
  if (index > value.length) return value.length
  return index
}
