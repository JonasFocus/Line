import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveAvailableCopyPath } from '../electron/savePath'

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
