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

export async function resolveAvailableCopyPath(
  currentPath: string,
  suggestedName: string,
  exists: PathExists = pathExists,
): Promise<string> {
  const directory = path.dirname(currentPath)
  const extension = path.extname(suggestedName)
  const stem = path.basename(suggestedName, extension)
  let copyNumber = 1
  let candidate = path.join(directory, suggestedName)

  while (path.resolve(candidate) === path.resolve(currentPath) || await exists(candidate)) {
    copyNumber += 1
    candidate = path.join(directory, `${stem} ${copyNumber}${extension}`)
  }

  return candidate
}
