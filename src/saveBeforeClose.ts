/** Unlinked documents (no path) always need Save As; otherwise honor the request. */
export function resolveSaveAs(path: string | null | undefined, requestedSaveAs = false): boolean {
  return requestedSaveAs || !path
}

export async function saveDocumentsBeforeClose(
  documentIds: readonly string[],
  save: (documentId: string) => Promise<boolean>,
  finalize: () => boolean | Promise<boolean> = () => true,
): Promise<boolean> {
  for (const documentId of documentIds) {
    if (!await save(documentId)) return false
  }

  return finalize()
}
