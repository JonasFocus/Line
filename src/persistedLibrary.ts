import { parseMarkdownMetadata } from './lib'
import type { LineDocument } from './lineDocument'

export const LIBRARY_STORAGE_KEY = 'line.library.v1'

function normalizeDocument(value: unknown): LineDocument | null {
  if (!value || typeof value !== 'object') return null

  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.content !== 'string') return null

  let metadata: ReturnType<typeof parseMarkdownMetadata> | null = null
  const getMetadata = () => {
    metadata ??= parseMarkdownMetadata(item.content as string)
    return metadata
  }

  return {
    id: item.id,
    title: typeof item.title === 'string' ? item.title : getMetadata().title,
    content: item.content,
    folder: typeof item.folder === 'string' && item.folder.trim() ? item.folder : 'Basics',
    tags: Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === 'string')
      : getMetadata().tags,
    favorite: item.favorite === true,
    updatedAt: typeof item.updatedAt === 'string' && item.updatedAt.trim() ? item.updatedAt : 'Just now',
    path: null,
    revision: typeof item.revision === 'string' ? item.revision : null,
    dirty: item.dirty === true,
  }
}

export function restorePersistedDocuments(
  stored: string | null,
  fallback: readonly LineDocument[],
): LineDocument[] {
  if (!stored) return [...fallback]

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return [...fallback]

    const normalized = parsed.map(normalizeDocument).filter((document): document is LineDocument => document !== null)
    const reservedIds = new Set(normalized.map((document) => document.id))
    const usedIds = new Set<string>()
    const nextRecoveryIndex = new Map<string, number>()
    const restored = normalized.map((document) => {
      if (!usedIds.has(document.id)) {
        usedIds.add(document.id)
        return document
      }

      let recoveryIndex = nextRecoveryIndex.get(document.id) ?? 2
      let recoveryId = `${document.id}-recovered-${recoveryIndex}`
      while (reservedIds.has(recoveryId) || usedIds.has(recoveryId)) {
        recoveryIndex += 1
        recoveryId = `${document.id}-recovered-${recoveryIndex}`
      }
      nextRecoveryIndex.set(document.id, recoveryIndex + 1)
      usedIds.add(recoveryId)
      return { ...document, id: recoveryId }
    })

    return restored.length ? restored : [...fallback]
  } catch {
    return [...fallback]
  }
}

export function loadPersistedDocuments(
  getStorage: () => Pick<Storage, 'getItem'>,
  fallback: readonly LineDocument[],
): LineDocument[] {
  try {
    const storage = getStorage()
    return restorePersistedDocuments(storage.getItem(LIBRARY_STORAGE_KEY), fallback)
  } catch {
    return [...fallback]
  }
}
