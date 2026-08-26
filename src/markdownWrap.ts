export type MarkdownWrapKind = 'bold' | 'italic' | 'link'

export type MarkdownWrapInput = {
  value: string
  selectionStart: number
  selectionEnd: number
  kind: MarkdownWrapKind
}

export type MarkdownWrapResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

const LINK_URL = 'https://'
const EMPTY_LINK_LABEL = 'text'

export function markdownWrapKindFromModKey(event: {
  altKey: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
}): MarkdownWrapKind | null {
  if (!event.metaKey || event.shiftKey || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'b') return 'bold'
  if (key === 'i') return 'italic'
  if (key === 'k') return 'link'
  return null
}

export function wrapMarkdownSelection({
  value,
  selectionStart,
  selectionEnd,
  kind,
}: MarkdownWrapInput): MarkdownWrapResult {
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)

  if (kind === 'link') return wrapLink(value, start, end)
  if (kind === 'bold') return toggleMarker(value, start, end, '**')
  return toggleItalic(value, start, end)
}

function replaceRange(
  value: string,
  start: number,
  end: number,
  replacement: string,
  nextStart: number,
  nextEnd: number,
): MarkdownWrapResult {
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  }
}

function hasMarkerBefore(value: string, start: number, marker: string): boolean {
  return start >= marker.length && value.slice(start - marker.length, start) === marker
}

function hasMarkerAfter(value: string, end: number, marker: string): boolean {
  return value.slice(end, end + marker.length) === marker
}

function toggleMarker(value: string, start: number, end: number, marker: string): MarkdownWrapResult {
  const selected = value.slice(start, end)
  const markerLength = marker.length

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= markerLength * 2) {
    const inner = selected.slice(markerLength, selected.length - markerLength)
    return replaceRange(value, start, end, inner, start, start + inner.length)
  }

  if (hasMarkerBefore(value, start, marker) && hasMarkerAfter(value, end, marker)) {
    const unwrapStart = start - markerLength
    return replaceRange(value, unwrapStart, end + markerLength, selected, unwrapStart, unwrapStart + selected.length)
  }

  const innerStart = start + markerLength
  return replaceRange(value, start, end, `${marker}${selected}${marker}`, innerStart, innerStart + selected.length)
}

function countRun(value: string, from: number, step: 1 | -1): number {
  let count = 0
  for (let index = from; index >= 0 && index < value.length && value[index] === '*'; index += step) {
    count += 1
  }
  return count
}

function hasOddItalicWrap(before: number, after: number): boolean {
  return before % 2 === 1 && after % 2 === 1
}

function toggleItalic(value: string, start: number, end: number): MarkdownWrapResult {
  const selected = value.slice(start, end)

  if (hasOddItalicWrap(countRun(selected, 0, 1), countRun(selected, selected.length - 1, -1))) {
    const inner = selected.slice(1, selected.length - 1)
    return replaceRange(value, start, end, inner, start, start + inner.length)
  }

  // Odd * counts on both sides mean italic is already on, including ***bold+italic***.
  if (hasOddItalicWrap(countRun(value, start - 1, -1), countRun(value, end, 1))) {
    const unwrapStart = start - 1
    return replaceRange(value, unwrapStart, end + 1, selected, unwrapStart, unwrapStart + selected.length)
  }

  const innerStart = start + 1
  return replaceRange(value, start, end, `*${selected}*`, innerStart, innerStart + selected.length)
}

function wrapLink(value: string, start: number, end: number): MarkdownWrapResult {
  const selected = value.slice(start, end)
  const label = selected.length > 0 ? selected : EMPTY_LINK_LABEL
  const inserted = `[${label}](${LINK_URL})`
  const urlStart = start + label.length + 3
  return replaceRange(value, start, end, inserted, urlStart, urlStart + LINK_URL.length)
}
