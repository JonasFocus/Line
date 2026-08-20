import { describe, expect, it } from 'vitest'

import {
  reconcileSaveState,
  resolveSaveChipLabel,
  resolveSaveState,
} from '../src/saveState'

describe('resolveSaveState', () => {
  it('marks dirty documents dirty for the save chip', () => {
    expect(resolveSaveState({ dirty: true })).toBe('dirty')
  })

  it('treats clean or missing documents as idle', () => {
    expect(resolveSaveState({ dirty: false })).toBe('idle')
    expect(resolveSaveState({})).toBe('idle')
    expect(resolveSaveState(null)).toBe('idle')
  })
})

describe('reconcileSaveState', () => {
  it('derives dirty from the document when selection is unchanged (cold start)', () => {
    expect(reconcileSaveState('idle', { dirty: true }, false)).toBe('dirty')
  })

  it('keeps in-flight saved/saving/error when selection is unchanged and clean', () => {
    expect(reconcileSaveState('saved', { dirty: false }, false)).toBe('saved')
    expect(reconcileSaveState('saving', { dirty: false }, false)).toBe('saving')
    expect(reconcileSaveState('error', { dirty: false }, false)).toBe('error')
  })

  it('forces dirty when the open document is dirty again', () => {
    expect(reconcileSaveState('saved', { dirty: true }, false)).toBe('dirty')
  })

  it('always follows the document when selection changes', () => {
    expect(reconcileSaveState('saving', { dirty: true }, true)).toBe('dirty')
    expect(reconcileSaveState('error', { dirty: false }, true)).toBe('idle')
  })
})

describe('resolveSaveChipLabel', () => {
  it('never says Saved while the selected document is dirty', () => {
    expect(resolveSaveChipLabel({ path: '/tmp/note.md' }, 'dirty')).toBe('Save')
    expect(resolveSaveChipLabel({ path: null }, 'dirty')).toBe('Not linked — Save As')
    expect(resolveSaveChipLabel({ path: '/tmp/note.md' }, 'idle')).toBe('Saved')
  })

  it('keeps unlinked copy for dirty drafts', () => {
    expect(resolveSaveChipLabel({ path: null }, 'dirty')).toBe('Not linked — Save As')
    expect(resolveSaveChipLabel({ path: null }, 'idle')).toBe('Not linked — Save As')
    expect(resolveSaveChipLabel({ path: null }, 'saved')).toBe('Not linked — Save As')
  })

  it('shows Saving and Retry over the unlinked label', () => {
    expect(resolveSaveChipLabel({ path: null }, 'saving')).toBe('Saving')
    expect(resolveSaveChipLabel({ path: null }, 'error')).toBe('Retry')
  })
})
