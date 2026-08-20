import { describe, expect, it } from 'vitest'

import {
  assertDocumentByteLimit,
  DOCUMENT_TOO_LARGE_MESSAGE,
  MAX_DOCUMENT_BYTES,
} from '../electron/documentSize'

describe('assertDocumentByteLimit', () => {
  it('allows content at the limit', () => {
    expect(() => assertDocumentByteLimit('a'.repeat(MAX_DOCUMENT_BYTES))).not.toThrow()
  })

  it('rejects content over the limit before any write', () => {
    expect(() => assertDocumentByteLimit('a'.repeat(MAX_DOCUMENT_BYTES + 1))).toThrow(
      DOCUMENT_TOO_LARGE_MESSAGE,
    )
  })

  it('counts utf8 bytes, not string length', () => {
    // "é" is 2 bytes in utf8
    const over = 'é'.repeat(Math.floor(MAX_DOCUMENT_BYTES / 2) + 1)
    expect(Buffer.byteLength(over, 'utf8')).toBeGreaterThan(MAX_DOCUMENT_BYTES)
    expect(() => assertDocumentByteLimit(over)).toThrow(DOCUMENT_TOO_LARGE_MESSAGE)
  })
})
