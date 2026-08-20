import { describe, expect, it, vi } from 'vitest'
import { resolveSaveAs, saveDocumentsBeforeClose } from '../src/saveBeforeClose'

describe('resolveSaveAs', () => {
  it('forces Save As when the document has no path', () => {
    expect(resolveSaveAs(null)).toBe(true)
    expect(resolveSaveAs(null, false)).toBe(true)
  })

  it('keeps normal Save when the document is already linked', () => {
    expect(resolveSaveAs('/Users/example/note.md')).toBe(false)
    expect(resolveSaveAs('/Users/example/note.md', false)).toBe(false)
  })

  it('honors an explicit Save As request for linked documents', () => {
    expect(resolveSaveAs('/Users/example/note.md', true)).toBe(true)
  })
})

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

  it('lets the close save callback force Save As for unlinked dirty documents', async () => {
    const documents = [
      { id: 'linked', path: '/tmp/linked.md', dirty: true },
      { id: 'draft', path: null, dirty: true },
    ]
    const requests: Array<{ id: string; saveAs: boolean }> = []

    await expect(saveDocumentsBeforeClose(
      documents.map((document) => document.id),
      async (documentId) => {
        const documentToSave = documents.find((document) => document.id === documentId)
        if (!documentToSave?.dirty) return true
        const saveAs = resolveSaveAs(documentToSave.path)
        requests.push({ id: documentId, saveAs })
        return true
      },
    )).resolves.toBe(true)

    expect(requests).toEqual([
      { id: 'linked', saveAs: false },
      { id: 'draft', saveAs: true },
    ])
  })
})
