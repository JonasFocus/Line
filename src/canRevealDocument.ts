/** Linked notes with a disk path can be revealed in Finder. */
export function canRevealDocument(path: string | null | undefined): path is string {
  return typeof path === 'string' && path.length > 0
}
