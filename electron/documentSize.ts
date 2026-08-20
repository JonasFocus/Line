export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export const DOCUMENT_TOO_LARGE_MESSAGE =
  'The selected file is larger than the 10 MB limit.'

/** Reject oversized content before any disk write so a committed save is never labeled a failure. */
export function assertDocumentByteLimit(content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw new Error(DOCUMENT_TOO_LARGE_MESSAGE)
  }
}
