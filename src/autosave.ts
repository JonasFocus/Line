import type { SaveState } from './saveState'

export const AUTOSAVE_DELAY_MS = 1500

export type AutosaveDocument = {
  dirty?: boolean
  path?: string | null
  saveState?: SaveState
}

/** Linked dirty files only. Unlinked notes still need Save As. */
export function shouldAutosave(document: AutosaveDocument | null | undefined): boolean {
  if (!document) return false
  if (document.saveState === 'saving' || document.saveState === 'error') return false
  if (document.dirty !== true) return false
  return typeof document.path === 'string' && document.path.length > 0
}
