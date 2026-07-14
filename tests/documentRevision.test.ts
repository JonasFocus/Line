import {
  link,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createDocumentRevision,
  DOCUMENT_CONFLICT_MESSAGE,
  writeFileIfUnchanged,
} from '../electron/documentRevision'

const temporaryDirectories: string[] = []

async function makeDocument(content = 'original') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'line-revision-'))
  const filePath = path.join(directory, 'note.md')
  temporaryDirectories.push(directory)
  await writeFile(filePath, content)
  return { directory, filePath, revision: createDocumentRevision(content) }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true }),
  ))
})

describe('writeFileIfUnchanged', () => {
  it('writes when the document still matches the opened revision', async () => {
    const { filePath, revision } = await makeDocument()

    await writeFileIfUnchanged(filePath, 'line edit', revision)

    expect(await readFile(filePath, 'utf8')).toBe('line edit')
  })

  it('rejects an external edit without overwriting it', async () => {
    const { filePath, revision } = await makeDocument()
    await writeFile(filePath, 'external edit')

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(await readFile(filePath, 'utf8')).toBe('external edit')
  })

  it('detects same-size edits even when modification time is restored', async () => {
    const { filePath, revision } = await makeDocument('version one')
    const originalTimes = await stat(filePath)
    await writeFile(filePath, 'version two')
    await utimes(filePath, originalTimes.atime, originalTimes.mtime)

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(await readFile(filePath, 'utf8')).toBe('version two')
  })

  it('treats deletion as a conflict instead of recreating the document', async () => {
    const { filePath, revision } = await makeDocument()
    await rm(filePath)

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('checks the current contents through symbolic and hard-link aliases', async () => {
    const { directory, filePath, revision } = await makeDocument()
    const symbolicPath = path.join(directory, 'symbolic.md')
    const hardPath = path.join(directory, 'hard.md')
    await symlink(filePath, symbolicPath)
    await link(filePath, hardPath)
    await writeFile(hardPath, 'external edit')

    await expect(
      writeFileIfUnchanged(symbolicPath, 'line edit', revision),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(await readFile(filePath, 'utf8')).toBe('external edit')
  })

  it('preserves hard-linked files when a guarded save cannot be atomic', async () => {
    const { directory, filePath, revision } = await makeDocument()
    const hardPath = path.join(directory, 'hard.md')
    await link(filePath, hardPath)

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision),
    ).rejects.toThrow('Use Save As')
    expect(await readFile(filePath, 'utf8')).toBe('original')
    expect(await readFile(hardPath, 'utf8')).toBe('original')
  })

  it('does not start the write after detecting a conflict', async () => {
    const { filePath, revision } = await makeDocument()
    const write = vi.fn(async () => undefined)
    await writeFile(filePath, 'external edit')

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision, write),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(write).not.toHaveBeenCalled()
  })

  it('revalidates after preparation and before the writer commits', async () => {
    const { filePath, revision } = await makeDocument()
    let committed = false
    const racingWrite = async (
      _filePath: string,
      content: string,
      options?: { validateBeforeCommit?: () => Promise<void> },
    ) => {
      await writeFile(filePath, 'external during save')
      await options?.validateBeforeCommit?.()
      committed = true
      await writeFile(filePath, content)
    }

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision, racingWrite),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(committed).toBe(false)
    expect(await readFile(filePath, 'utf8')).toBe('external during save')
  })

  it('rejects when the committed bytes change before the save returns', async () => {
    const { filePath, revision } = await makeDocument()
    const postWriteRace = async (
      _filePath: string,
      content: string,
      options?: { validateBeforeCommit?: () => Promise<void> },
    ) => {
      await options?.validateBeforeCommit?.()
      await writeFile(filePath, content)
      await writeFile(filePath, 'external after save')
    }

    await expect(
      writeFileIfUnchanged(filePath, 'line edit', revision, postWriteRace),
    ).rejects.toThrow(DOCUMENT_CONFLICT_MESSAGE)
    expect(await readFile(filePath, 'utf8')).toBe('external after save')
  })
})
