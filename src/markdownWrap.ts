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

function isItalicInside(selected: string): boolean {
  if (selected.length < 2) return false
  if (!selected.startsWith('*') || !selected.endsWith('*')) return false
  // Leave **bold** alone; only unwrap a single-star wrap.
  return !selected.startsWith('**') && !selected.endsWith('**')
}

function isItalicAround(value: string, start: number, end: number): boolean {
  if (!hasMarkerBefore(value, start, '*') || !hasMarkerAfter(value, end, '*')) return false
  return !hasMarkerBefore(value, start, '**') && !hasMarkerAfter(value, end, '**')
}

function toggleItalic(value: string, start: number, end: number): MarkdownWrapResult {
  const selected = value.slice(start, end)

  if (isItalicInside(selected)) {
    const inner = selected.slice(1, selected.length - 1)
    return replaceRange(value, start, end, inner, start, start + inner.length)
  }

  if (isItalicAround(value, start, end)) {
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
