import path from 'node:path'

import type { LineDocument } from './types'

/**
 * Build the post-save document from known write inputs.
 * Avoids a blocking content re-read after a successful write.
 */
export function createSavedLineDocument(input: {
  filePath: string
  content: string
  revision: string
  modifiedAt: string | null
}): LineDocument {
  return {
    id: input.filePath,
    path: input.filePath,
    name: path.basename(input.filePath),
    content: input.content,
    modifiedAt: input.modifiedAt,
    revision: input.revision,
  }
}
