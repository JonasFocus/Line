export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** Map the open document's dirty flag to the chip's idle/dirty state. */
export function resolveSaveState(document: { dirty?: boolean } | null | undefined): 'dirty' | 'idle' {
  return document?.dirty ? 'dirty' : 'idle'
}

/**
 * Align saveState with the selected document.
 * When selection is unchanged (cold start / library churn), keep in-flight
 * saving/error/saved unless the document is dirty again.
 */
export function reconcileSaveState(
  current: SaveState,
  document: { dirty?: boolean } | null | undefined,
  selectionChanged: boolean,
): SaveState {
  const fromDocument = resolveSaveState(document)
  if (selectionChanged) return fromDocument
  if (document?.dirty) return 'dirty'
  if (current === 'saving' || current === 'error' || current === 'saved') return current
  return fromDocument
}

/** Chip label for the current document + saveState. Dirty must never read "Saved". */
export function resolveSaveChipLabel(
  document: { path?: string | null } | null | undefined,
  saveState: SaveState,
): string {
  if (document && !document.path && saveState !== 'saving' && saveState !== 'error') {
    return 'Not linked — Save As'
  }
  if (saveState === 'saving') return 'Saving'
  if (saveState === 'dirty') return 'Save'
  if (saveState === 'error') return 'Retry'
  return 'Saved'
}
