import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import {
  atomicWriteFile,
  type AtomicWriteOptions,
} from './atomicWriteFile'

export const DOCUMENT_CONFLICT_MESSAGE =
  'This document changed on disk. Use Save As to keep your version without overwriting the external changes.'

type WriteFile = (
  filePath: string,
  content: string,
  options?: AtomicWriteOptions,
) => Promise<void>

export function createDocumentRevision(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('base64url')}`
}

async function readDocumentRevision(filePath: string): Promise<string | null> {
  try {
    return createDocumentRevision(await readFile(filePath, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeFileIfUnchanged(
  filePath: string,
  content: string,
  expectedRevision: string,
  writeFile: WriteFile = atomicWriteFile,
): Promise<string> {
  const validateRevision = async () => {
    const currentRevision = await readDocumentRevision(filePath)
    if (currentRevision !== expectedRevision) {
      throw new Error(DOCUMENT_CONFLICT_MESSAGE)
    }
  }

  await validateRevision()
  await writeFile(filePath, content, {
    requireAtomic: true,
    validateBeforeCommit: validateRevision,
  })

  const writtenRevision = createDocumentRevision(content)
  if (await readDocumentRevision(filePath) !== writtenRevision) {
    throw new Error(DOCUMENT_CONFLICT_MESSAGE)
  }

  return writtenRevision
}
