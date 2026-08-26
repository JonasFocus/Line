import { describe, expect, it } from 'vitest'

import { resolveMenuLayoutAction } from '../src/menuLayout'

describe('resolveMenuLayoutAction', () => {
  it('maps layout menu commands to editor modes', () => {
    expect(resolveMenuLayoutAction('edit-mode')).toBe('edit')
    expect(resolveMenuLayoutAction('split-mode')).toBe('split')
    expect(resolveMenuLayoutAction('preview-mode')).toBe('preview')
  })

  it('ignores unrelated menu commands', () => {
    expect(resolveMenuLayoutAction('toggle-inspector')).toBeNull()
    expect(resolveMenuLayoutAction('new')).toBeNull()
    expect(resolveMenuLayoutAction('save')).toBeNull()
  })
})
