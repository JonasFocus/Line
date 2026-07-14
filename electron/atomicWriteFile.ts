import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import {
  access,
  copyFile,
  open,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type WriteTemporaryFile = (
  sourcePath: string | null,
  temporaryPath: string,
  content: string,
  existingMode: number | null,
) => Promise<void>

type ReplaceFile = (source: string, destination: string) => Promise<void>
type SyncDirectory = (directoryPath: string) => Promise<void>

export interface AtomicWriteOptions {
  requireAtomic?: boolean
  replaceFile?: ReplaceFile
  syncDirectory?: SyncDirectory
  validateBeforeCommit?: () => Promise<void>
  writeTemporaryFile?: WriteTemporaryFile
}

export const ATOMIC_WRITE_UNAVAILABLE_MESSAGE =
  'This document cannot be safely saved at its current location. Use Save As to keep your version.'

async function writeTemporaryFile(
  sourcePath: string | null,
  temporaryPath: string,
  content: string,
  existingMode: number | null,
): Promise<void> {
  if (sourcePath) {
    if (process.platform === 'darwin') {
      await execFileAsync('/bin/cp', ['-p', sourcePath, temporaryPath])
    } else {
      await copyFile(sourcePath, temporaryPath)
    }
  }

  const handle = await open(
    temporaryPath,
    sourcePath ? 'r+' : 'wx',
    existingMode ?? 0o666,
  )

  try {
    if (sourcePath) {
      await handle.truncate(0)
    }
    await handle.writeFile(content, 'utf8')
    if (existingMode !== null) {
      await handle.chmod(existingMode)
    }
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(directoryPath: string): Promise<void> {
  const handle = await open(directoryPath, 'r')

  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectoryWhenSupported(
  directoryPath: string,
  sync: SyncDirectory,
): Promise<void> {
  try {
    await sync(directoryPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EINVAL' || code === 'ENOTSUP' || code === 'EISDIR') {
      return
    }
    throw error
  }
}

async function writeInPlace(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf8')
  const handle = await open(filePath, 'r')

  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export async function resolveWriteDestination(
  filePath: string,
): Promise<string> {
  try {
    return await realpath(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return filePath
    }
    throw error
  }
}

export async function resolveWriteQueueKey(filePath: string): Promise<string> {
  const destination = await resolveWriteDestination(filePath)
  const fileStats = await stat(destination).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  })

  return fileStats && fileStats.nlink > 1
    ? `inode:${fileStats.dev}:${fileStats.ino}`
    : destination
}

export async function atomicWriteFile(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const destination = await resolveWriteDestination(filePath)
  const existingStats = await stat(destination).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  })

  if (existingStats) {
    await access(destination, constants.W_OK)
  }

  // Replacing an inode would silently sever its other hard links. Preserve the
  // existing behavior for this uncommon case instead of changing file identity.
  if (existingStats && existingStats.nlink > 1) {
    if (options.requireAtomic) {
      throw new Error(ATOMIC_WRITE_UNAVAILABLE_MESSAGE)
    }
    await options.validateBeforeCommit?.()
    await writeInPlace(destination, content)
    return
  }

  const directoryPath = path.dirname(destination)
  try {
    await access(directoryPath, constants.W_OK)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (existingStats && (code === 'EACCES' || code === 'EPERM')) {
      if (options.requireAtomic) {
        throw new Error(ATOMIC_WRITE_UNAVAILABLE_MESSAGE)
      }
      await options.validateBeforeCommit?.()
      await writeInPlace(destination, content)
      return
    }
    throw error
  }

  const temporaryPath = path.join(
    directoryPath,
    `.line-${randomUUID()}.tmp`,
  )
  const existingMode = existingStats ? existingStats.mode & 0o777 : null
  const writeTemp = options.writeTemporaryFile ?? writeTemporaryFile
  const replaceFile = options.replaceFile ?? rename
  const sync = options.syncDirectory ?? syncDirectory
  let committed = false

  try {
    await writeTemp(
      existingStats ? destination : null,
      temporaryPath,
      content,
      existingMode,
    )
    await options.validateBeforeCommit?.()
    await replaceFile(temporaryPath, destination)
    committed = true
    await syncDirectoryWhenSupported(directoryPath, sync)
  } finally {
    if (!committed) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }
}
