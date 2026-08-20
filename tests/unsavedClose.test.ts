import { describe, expect, it } from 'vitest'
import {
  CLOSE_PREPARE_TIMEOUT_MS,
  resolveUnsavedCloseAction,
  UNSAVED_CLOSE_BUTTONS,
} from '../electron/unsavedClose'

describe('unsaved close prompt', () => {
  it('keeps the button order aligned with the response mapping', () => {
    expect(UNSAVED_CLOSE_BUTTONS).toEqual(['Save', 'Cancel', 'Close and Keep Changes'])
    expect(resolveUnsavedCloseAction(0)).toBe('save')
    expect(resolveUnsavedCloseAction(1)).toBe('cancel')
    expect(resolveUnsavedCloseAction(2)).toBe('close')
  })

  it('fails closed for an unexpected response', () => {
    expect(resolveUnsavedCloseAction(-1)).toBe('cancel')
    expect(resolveUnsavedCloseAction(9)).toBe('cancel')
  })

  it('arms a finite prepare-close timeout so a missing finishPrepareClose cannot wedge forever', () => {
    expect(CLOSE_PREPARE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(CLOSE_PREPARE_TIMEOUT_MS).toBeLessThanOrEqual(5 * 60_000)
  })
})
