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
