export function formatWordCountLabel(count: number): string {
  return `${count.toLocaleString()} words`
}

export function formatReadTimeLabel(minutes: number): string {
  return minutes === 1 ? '1 min read' : `${minutes} min read`
}

/** Basename for a linked document path, or null when the note is unlinked. */
export function footerFileLabel(path: string | null | undefined): string | null {
  if (!path) return null
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const slash = normalized.lastIndexOf('/')
  const name = slash === -1 ? normalized : normalized.slice(slash + 1)
  return name || null
}
