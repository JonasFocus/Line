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

/** Library pane heading for the live Unlinked / tag / default filter. */
export function libraryPaneHeading(
  activeFilter: string,
  activeTag: string | null,
): string {
  if (activeFilter === 'unlinked') return 'Unlinked'
  if (activeTag) return `#${activeTag}`
  return 'Library'
}

type LibraryFilterTag = {
  activeFilter: string
  activeTag: string | null
}

/**
 * Next Unlinked / tag pair so only one named filter is live.
 * All Documents and Unlinked clear the tag; a tag clears Unlinked.
 * All Tags (null) only clears the tag.
 */
export function nextExclusiveLibraryFilter(
  current: LibraryFilterTag,
  change: { filter: string } | { tag: string | null },
): LibraryFilterTag {
  if ('filter' in change) {
    const { filter } = change
    if (filter === 'all' || filter === 'unlinked') {
      return { activeFilter: filter, activeTag: null }
    }
    return { activeFilter: filter, activeTag: current.activeTag }
  }

  if (change.tag === null) {
    return { activeFilter: current.activeFilter, activeTag: null }
  }

  return {
    activeFilter: current.activeFilter === 'unlinked' ? 'all' : current.activeFilter,
    activeTag: change.tag,
  }
}
