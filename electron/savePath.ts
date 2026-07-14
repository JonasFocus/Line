import { access } from 'node:fs/promises'
import path from 'node:path'

type PathExists = (filePath: string) => Promise<boolean>

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function resolveAvailablePath(
  directory: string,
  suggestedName: string,
  excludedPath: string | null,
  exists: PathExists,
): Promise<string> {
  const extension = path.extname(suggestedName)
  const stem = path.basename(suggestedName, extension)
  let copyNumber = 1
  let candidate = path.join(directory, suggestedName)

  while (
    (excludedPath && path.resolve(candidate) === path.resolve(excludedPath)) ||
    await exists(candidate)
  ) {
    copyNumber += 1
    candidate = path.join(directory, `${stem} ${copyNumber}${extension}`)
  }

  return candidate
}

export async function resolveAvailableCopyPath(
  currentPath: string,
  suggestedName: string,
  exists: PathExists = pathExists,
): Promise<string> {
  return resolveAvailablePath(
    path.dirname(currentPath),
    suggestedName,
    currentPath,
    exists,
  )
}

export async function resolveSaveDialogDefaultPath({
  currentPath,
  currentPathGranted,
  defaultToDocuments,
  documentsPath,
  saveCopy,
  suggestedName,
}: {
  currentPath: string | null
  currentPathGranted: boolean
  defaultToDocuments: boolean
  documentsPath: string
  saveCopy: boolean
  suggestedName: string
}, exists: PathExists = pathExists): Promise<string> {
  if (defaultToDocuments) {
    return resolveAvailablePath(
      documentsPath,
      suggestedName,
      null,
      exists,
    )
  }

  if (!currentPath || !currentPathGranted) {
    return path.join(documentsPath, suggestedName)
  }

  return saveCopy
    ? resolveAvailableCopyPath(currentPath, suggestedName)
    : currentPath
}
