import { describe, expect, it } from 'vitest'

import { createSavedLineDocument } from '../electron/savedDocument'

describe('createSavedLineDocument', () => {
  it('builds the saved document from write inputs without requiring a content re-read', () => {
    expect(
      createSavedLineDocument({
        filePath: '/Users/me/Notes/draft.md',
        content: '# Draft\n',
        revision: 'sha256:abc',
        modifiedAt: '2026-08-20T12:00:00.000Z',
      }),
    ).toEqual({
      id: '/Users/me/Notes/draft.md',
      path: '/Users/me/Notes/draft.md',
      name: 'draft.md',
      content: '# Draft\n',
      modifiedAt: '2026-08-20T12:00:00.000Z',
      revision: 'sha256:abc',
    })
  })
})
