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
