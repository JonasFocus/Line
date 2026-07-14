import {
  chmod,
  link,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

import {
  atomicWriteFile,
  resolveWriteDestination,
  resolveWriteQueueKey,
} from '../electron/atomicWriteFile'

const execFileAsync = promisify(execFile)

const temporaryDirectories: string[] = []

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'line-atomic-write-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  )
})

describe('atomicWriteFile', () => {
  it('creates a new file without leaving temporary data behind', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')

    await atomicWriteFile(filePath, 'new document')

    expect(await readFile(filePath, 'utf8')).toBe('new document')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('replaces an existing file and preserves permissions under a restrictive umask', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    await writeFile(filePath, 'original')
    await chmod(filePath, 0o666)

    const originalUmask = process.umask(0o077)
    try {
      await atomicWriteFile(filePath, 'replacement')
    } finally {
      process.umask(originalUmask)
    }

    expect(await readFile(filePath, 'utf8')).toBe('replacement')
    expect((await stat(filePath)).mode & 0o777).toBe(0o666)
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it.runIf(process.platform === 'darwin')(
    'preserves macOS extended attributes',
    async () => {
      const directory = await makeTemporaryDirectory()
      const filePath = path.join(directory, 'note.md')
      await writeFile(filePath, 'original')
      await execFileAsync('/usr/bin/xattr', [
        '-w',
        'com.line.review',
        'preserved',
        filePath,
      ])

      await atomicWriteFile(filePath, 'replacement')

      const { stdout } = await execFileAsync('/usr/bin/xattr', [
        '-p',
        'com.line.review',
        filePath,
      ])
      expect(stdout.trim()).toBe('preserved')
    },
  )

  it('preserves the original and removes partial temporary data after a write failure', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    const failure = Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    await writeFile(filePath, 'original')

    await expect(
      atomicWriteFile(filePath, 'replacement', {
        writeTemporaryFile: async (_sourcePath, temporaryPath) => {
          await writeFile(temporaryPath, 'partial replacement')
          throw failure
        },
      }),
    ).rejects.toBe(failure)

    expect(await readFile(filePath, 'utf8')).toBe('original')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('preserves the original and removes the temporary file after a replacement failure', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    const failure = Object.assign(new Error('rename failed'), { code: 'EIO' })
    await writeFile(filePath, 'original')

    await expect(
      atomicWriteFile(filePath, 'replacement', {
        replaceFile: async () => {
          throw failure
        },
      }),
    ).rejects.toBe(failure)

    expect(await readFile(filePath, 'utf8')).toBe('original')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('revalidates immediately before replacing the destination', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    await writeFile(filePath, 'original')

    await expect(
      atomicWriteFile(filePath, 'line edit', {
        validateBeforeCommit: async () => {
          if (await readFile(filePath, 'utf8') !== 'original') {
            throw new Error('document changed')
          }
        },
        writeTemporaryFile: async (_sourcePath, temporaryPath, content) => {
          await writeFile(temporaryPath, content)
          await writeFile(filePath, 'external during save')
        },
      }),
    ).rejects.toThrow('document changed')

    expect(await readFile(filePath, 'utf8')).toBe('external during save')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('keeps symbolic links intact while replacing their target contents', async () => {
    const directory = await makeTemporaryDirectory()
    const targetPath = path.join(directory, 'target.md')
    const linkPath = path.join(directory, 'note.md')
    await writeFile(targetPath, 'original')
    await symlink(targetPath, linkPath)

    await atomicWriteFile(linkPath, 'replacement')

    expect((await lstat(linkPath)).isSymbolicLink()).toBe(true)
    expect(await readFile(targetPath, 'utf8')).toBe('replacement')
    expect((await readdir(directory)).sort()).toEqual(['note.md', 'target.md'])
  })

  it('resolves symbolic links to a shared save-queue destination', async () => {
    const directory = await makeTemporaryDirectory()
    const targetPath = path.join(directory, 'target.md')
    const linkPath = path.join(directory, 'note.md')
    await writeFile(targetPath, 'original')
    await symlink(targetPath, linkPath)

    const linkedDestination = await resolveWriteDestination(linkPath)
    const directDestination = await resolveWriteDestination(targetPath)

    expect(linkedDestination).toBe(directDestination)
  })

  it('preserves hard-link identity', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    const linkedPath = path.join(directory, 'linked.md')
    await writeFile(filePath, 'original')
    await link(filePath, linkedPath)

    await atomicWriteFile(filePath, 'replacement')

    expect(await readFile(linkedPath, 'utf8')).toBe('replacement')
    expect((await stat(filePath)).ino).toBe((await stat(linkedPath)).ino)
  })

  it('uses one save-queue key for hard-link aliases', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    const linkedPath = path.join(directory, 'linked.md')
    await writeFile(filePath, 'original')
    await link(filePath, linkedPath)

    const directKey = await resolveWriteQueueKey(filePath)
    const linkedKey = await resolveWriteQueueKey(linkedPath)

    expect(directKey).toBe(linkedKey)
    expect(directKey).toMatch(/^inode:/)
  })

  it('falls back to in-place saves when the file is writable but its directory is not', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    await writeFile(filePath, 'original')
    await chmod(filePath, 0o666)
    await chmod(directory, 0o555)

    try {
      await atomicWriteFile(filePath, 'replacement')
    } finally {
      await chmod(directory, 0o755)
    }

    expect(await readFile(filePath, 'utf8')).toBe('replacement')
    expect(await readdir(directory)).toEqual(['note.md'])
  })

  it('ignores unsupported directory sync errors after a successful replacement', async () => {
    const directory = await makeTemporaryDirectory()
    const filePath = path.join(directory, 'note.md')
    await writeFile(filePath, 'original')

    await expect(
      atomicWriteFile(filePath, 'replacement', {
        syncDirectory: async () => {
          throw Object.assign(new Error('not supported'), { code: 'ENOTSUP' })
        },
      }),
    ).resolves.toBeUndefined()

    expect(await readFile(filePath, 'utf8')).toBe('replacement')
  })
})
