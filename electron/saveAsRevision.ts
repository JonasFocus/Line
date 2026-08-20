/**
 * When Save As overwrites the current granted path, keep the conflict revision guard.
 * A newly picked path must not inherit conflict checks.
 */
export function resolveSaveAsExpectedRevision(input: {
  chosenPath: string
  currentPath: string | null
  currentPathGranted: boolean
  expectedRevision?: string
}): string | undefined {
  if (
    input.currentPath !== null &&
    input.chosenPath === input.currentPath &&
    input.currentPathGranted &&
    typeof input.expectedRevision === 'string'
  ) {
    return input.expectedRevision
  }
  return undefined
}
