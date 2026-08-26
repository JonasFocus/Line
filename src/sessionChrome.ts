export const SESSION_STORAGE_KEY = 'line.session.v1'

export type EditorMode = 'edit' | 'split' | 'preview'

export type SessionChrome = {
  selectedId: string | null
  mode: EditorMode
  inspectorOpen: boolean
}

function isEditorMode(value: unknown): value is EditorMode {
  return value === 'edit' || value === 'split' || value === 'preview'
}

function defaultSessionChrome(documentIds: readonly string[]): SessionChrome {
  return {
    selectedId: documentIds[0] ?? null,
    mode: 'edit',
    inspectorOpen: false,
  }
}

function resolveSelectedId(selectedId: unknown, documentIds: readonly string[]): string | null {
  if (typeof selectedId === 'string' && documentIds.includes(selectedId)) {
    return selectedId
  }

  return documentIds[0] ?? null
}

export function restoreSessionChrome(
  stored: string | null,
  documentIds: readonly string[],
): SessionChrome {
  const fallback = defaultSessionChrome(documentIds)
  if (!stored) return fallback

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback

    const item = parsed as Record<string, unknown>
    return {
      selectedId: resolveSelectedId(item.selectedId, documentIds),
      mode: isEditorMode(item.mode) ? item.mode : 'edit',
      inspectorOpen: item.inspectorOpen === true,
    }
  } catch {
    return fallback
  }
}

export function loadSessionChrome(
  getStorage: () => Pick<Storage, 'getItem'>,
  documentIds: readonly string[],
): SessionChrome {
  try {
    const storage = getStorage()
    return restoreSessionChrome(storage.getItem(SESSION_STORAGE_KEY), documentIds)
  } catch {
    return defaultSessionChrome(documentIds)
  }
}

export function saveSessionChrome(
  getStorage: () => Pick<Storage, 'setItem'>,
  chrome: SessionChrome,
): boolean {
  try {
    const storage = getStorage()
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(chrome))
    return true
  } catch {
    return false
  }
}
