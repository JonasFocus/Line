import { describe, expect, it, vi } from 'vitest'
import { saveDocumentsBeforeClose } from '../src/saveBeforeClose'

describe('saveDocumentsBeforeClose', () => {
  it('saves every dirty document in order', async () => {
    const save = vi.fn(async () => true)

    await expect(saveDocumentsBeforeClose(['first', 'second'], save)).resolves.toBe(true)
    expect(save.mock.calls).toEqual([['first'], ['second']])
  })

  it('stops closing when a save is cancelled or fails', async () => {
    const save = vi.fn(async (documentId: string) => documentId !== 'second')

    await expect(saveDocumentsBeforeClose(['first', 'second', 'third'], save)).resolves.toBe(false)
    expect(save.mock.calls).toEqual([['first'], ['second']])
  })

  it('allows closing immediately when no documents are dirty', async () => {
    const save = vi.fn(async () => true)

    await expect(saveDocumentsBeforeClose([], save)).resolves.toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('rechecks close readiness after every requested save completes', async () => {
    const save = vi.fn(async () => true)
    const finalize = vi.fn(() => false)

    await expect(saveDocumentsBeforeClose(['first'], save, finalize)).resolves.toBe(false)
    expect(finalize).toHaveBeenCalledOnce()
  })
})
