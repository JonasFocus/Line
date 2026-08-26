import { describe, expect, it } from 'vitest'

import { appShellClassName } from '../src/focusMode'

describe('appShellClassName', () => {
  it('hides the inspector when it is closed', () => {
    expect(appShellClassName({ inspectorOpen: false, focusMode: false })).toBe('app-shell inspector-hidden')
  })

  it('marks the inspector as visible when it is open', () => {
    expect(appShellClassName({ inspectorOpen: true, focusMode: false })).toBe('app-shell inspector-visible')
  })

  it('adds focus-mode without closing the inspector', () => {
    expect(appShellClassName({ inspectorOpen: true, focusMode: true })).toBe('app-shell inspector-visible focus-mode')
  })

  it('adds focus-mode while the inspector stays hidden', () => {
    expect(appShellClassName({ inspectorOpen: false, focusMode: true })).toBe('app-shell inspector-hidden focus-mode')
  })
})
