import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  resolveAvailableCopyPath,
  resolveSaveDialogDefaultPath,
} from '../electron/savePath'

describe('resolveAvailableCopyPath', () => {
  it('uses the suggested sibling when it is available', async () => {
    const currentPath = path.join('/notes', 'Draft.md')

    await expect(resolveAvailableCopyPath(
      currentPath,
      'Draft (Line copy).md',
      async () => false,
    )).resolves.toBe(path.join('/notes', 'Draft (Line copy).md'))
  })

  it('never defaults recovery to the conflicted original', async () => {
    const currentPath = path.join('/notes', 'Draft (Line copy).md')

    await expect(resolveAvailableCopyPath(
      currentPath,
      'Draft (Line copy).md',
      async () => false,
    )).resolves.toBe(path.join('/notes', 'Draft (Line copy) 2.md'))
  })

  it('increments past existing recovery copies', async () => {
    const currentPath = path.join('/notes', 'Draft.md')
    const existing = new Set([
      path.join('/notes', 'Draft (Line copy).md'),
      path.join('/notes', 'Draft (Line copy) 2.md'),
    ])

    await expect(resolveAvailableCopyPath(
      currentPath,
      'Draft (Line copy).md',
      async (candidate) => existing.has(candidate),
    )).resolves.toBe(path.join('/notes', 'Draft (Line copy) 3.md'))
  })
})

describe('resolveSaveDialogDefaultPath', () => {
  it('uses Documents for recovery when the current location is unsafe', async () => {
    await expect(resolveSaveDialogDefaultPath({
      currentPath: path.join('/restricted', 'Draft.md'),
      currentPathGranted: true,
      defaultToDocuments: true,
      documentsPath: '/Documents',
      saveCopy: true,
      suggestedName: 'Draft (Line copy).md',
    }, async () => false)).resolves.toBe(path.join('/Documents', 'Draft (Line copy).md'))
  })

  it('increments past existing recovery copies in Documents', async () => {
    const existing = new Set([
      path.join('/Documents', 'Draft (Line copy).md'),
      path.join('/Documents', 'Draft (Line copy) 2.md'),
    ])

    await expect(resolveSaveDialogDefaultPath({
      currentPath: path.join('/restricted', 'Draft.md'),
      currentPathGranted: true,
      defaultToDocuments: true,
      documentsPath: '/Documents',
      saveCopy: true,
      suggestedName: 'Draft (Line copy).md',
    }, async (candidate) => existing.has(candidate))).resolves.toBe(
      path.join('/Documents', 'Draft (Line copy) 3.md'),
    )
  })

  it('keeps conflict-recovery copies beside the current document', async () => {
    await expect(resolveSaveDialogDefaultPath({
      currentPath: path.join('/notes', 'Draft.md'),
      currentPathGranted: true,
      defaultToDocuments: false,
      documentsPath: '/Documents',
      saveCopy: true,
      suggestedName: 'Draft (Line copy).md',
    })).resolves.toBe(path.join('/notes', 'Draft (Line copy).md'))
  })
})
