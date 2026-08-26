export interface LineDocument {
  id: string
  title: string
  content: string
  folder: string
  tags: string[]
  favorite: boolean
  updatedAt: string
  updatedAtMs?: number
  path: string | null
  revision: string | null
  dirty?: boolean
}

/** Session-only notes with no disk path (null or empty). */
export function documentIsUnlinked(document: Pick<LineDocument, 'path'>): boolean {
  return !document.path
}
