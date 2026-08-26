type LibraryKeyboardInput = {
  key: string
  selectedId: string | null
  visibleIds: readonly string[]
}

export function resolveLibraryKeyboardTarget({
  key,
  selectedId,
  visibleIds,
}: LibraryKeyboardInput): string | null {
  if (visibleIds.length === 0) return null

  const first = visibleIds[0]
  const last = visibleIds[visibleIds.length - 1]
  const selectedIndex = selectedId === null ? -1 : visibleIds.indexOf(selectedId)

  if (key === 'Home') return first
  if (key === 'End') return last

  if (key === 'ArrowDown') {
    if (selectedIndex < 0) return first
    return visibleIds[Math.min(selectedIndex + 1, visibleIds.length - 1)]
  }

  if (key === 'ArrowUp') {
    if (selectedIndex < 0) return last
    return visibleIds[Math.max(selectedIndex - 1, 0)]
  }

  return null
}
