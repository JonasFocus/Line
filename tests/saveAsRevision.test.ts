import { describe, expect, it } from 'vitest'

import { resolveSaveAsExpectedRevision } from '../electron/saveAsRevision'

describe('resolveSaveAsExpectedRevision', () => {
  it('keeps the revision guard when Save As overwrites the current granted path', () => {
    expect(
      resolveSaveAsExpectedRevision({
        chosenPath: '/tmp/note.md',
        currentPath: '/tmp/note.md',
        currentPathGranted: true,
        expectedRevision: 'sha256:abc',
      }),
    ).toBe('sha256:abc')
  })

  it('does not conflict-check a newly picked Save As path', () => {
    expect(
      resolveSaveAsExpectedRevision({
        chosenPath: '/tmp/copy.md',
        currentPath: '/tmp/note.md',
        currentPathGranted: true,
        expectedRevision: 'sha256:abc',
      }),
    ).toBeUndefined()
  })

  it('skips the guard when the current path was never granted', () => {
    expect(
      resolveSaveAsExpectedRevision({
        chosenPath: '/tmp/note.md',
        currentPath: '/tmp/note.md',
        currentPathGranted: false,
        expectedRevision: 'sha256:abc',
      }),
    ).toBeUndefined()
  })
})
