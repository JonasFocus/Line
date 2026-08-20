export function resolveVisibleSelection(
  selectedId: string | null,
  visibleIds: readonly string[],
): string | null {
  if (selectedId && visibleIds.includes(selectedId)) {
    return selectedId
  }

  return visibleIds[0] ?? null
}

export function resolveSelectionAfterDocumentsChange(
  selectedId: string | null,
  documentIds: readonly string[],
  visibleIds: readonly string[],
): string | null {
  if (selectedId && documentIds.includes(selectedId)) {
    return selectedId
  }

  return resolveVisibleSelection(selectedId, visibleIds)
}

/** Drop a tag filter when that tag no longer exists on any document. */
export function resolveActiveTag(
  activeTag: string | null,
  availableTags: readonly string[],
): string | null {
  if (!activeTag) return null
  return availableTags.includes(activeTag) ? activeTag : null
}

/** Drop the Unlinked filter when no session-only notes remain. */
export function resolveActiveFilter(
  activeFilter: string,
  hasUnlinked: boolean,
): string {
  if (activeFilter === 'unlinked' && !hasUnlinked) return 'all'
  return activeFilter
}
