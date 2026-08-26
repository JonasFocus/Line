import { describe, expect, it } from 'vitest'

import { AUTOSAVE_DELAY_MS, shouldAutosave } from '../src/autosave'

describe('AUTOSAVE_DELAY_MS', () => {
  it('waits 1500ms after idle before writing', () => {
    expect(AUTOSAVE_DELAY_MS).toBe(1500)
  })
})

describe('shouldAutosave', () => {
  it('autosaves dirty documents that already have a disk path', () => {
    expect(shouldAutosave({ dirty: true, path: '/Users/jonas/notes/draft.md' })).toBe(true)
  })

  it('skips unlinked notes that still need Save As', () => {
    expect(shouldAutosave({ dirty: true, path: null })).toBe(false)
    expect(shouldAutosave({ dirty: true, path: '' })).toBe(false)
    expect(shouldAutosave({ dirty: true })).toBe(false)
  })

  it('skips clean linked documents', () => {
    expect(shouldAutosave({ dirty: false, path: '/tmp/note.md' })).toBe(false)
    expect(shouldAutosave({ path: '/tmp/note.md' })).toBe(false)
  })

  it('skips autosave while a save is in flight or failed', () => {
    expect(shouldAutosave({ dirty: true, path: '/tmp/note.md', saveState: 'saving' })).toBe(false)
    expect(shouldAutosave({ dirty: true, path: '/tmp/note.md', saveState: 'error' })).toBe(false)
  })

  it('allows idle, dirty, and saved chip states when the file is still dirty and linked', () => {
    expect(shouldAutosave({ dirty: true, path: '/tmp/note.md', saveState: 'idle' })).toBe(true)
    expect(shouldAutosave({ dirty: true, path: '/tmp/note.md', saveState: 'dirty' })).toBe(true)
    expect(shouldAutosave({ dirty: true, path: '/tmp/note.md', saveState: 'saved' })).toBe(true)
  })

  it('skips a missing document', () => {
    expect(shouldAutosave(null)).toBe(false)
    expect(shouldAutosave(undefined)).toBe(false)
  })
})
