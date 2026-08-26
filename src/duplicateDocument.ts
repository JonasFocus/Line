import type { LineDocument } from './lineDocument'

export function duplicateLineDocument(
  document: LineDocument,
  id: string,
  nowLabel = 'Just now',
): LineDocument {
  const untitled = !document.title || document.title === 'Untitled'

  return {
    id,
    title: untitled ? 'Untitled' : `${document.title} copy`,
    content: document.content,
    folder: document.folder,
    tags: [...document.tags],
    favorite: false,
    updatedAt: nowLabel,
    path: null,
    revision: null,
    dirty: true,
  }
}
