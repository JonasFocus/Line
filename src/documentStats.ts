import { countWords, deriveHeadings, estimateReadTime } from './lib'

export type DocumentStats = {
  words: number
  characters: number
  charactersNoSpaces: number
  readTimeMinutes: number
  headingCount: number
  tagCount: number
  pathLabel: string
}

function pathLabelFromPath(path: string | null): string {
  if (!path) return 'Not linked'
  const name = path.split(/[/\\]/).filter(Boolean).pop()
  return name || 'Not linked'
}

export function buildDocumentStats(document: {
  content: string
  path: string | null
  tags: string[]
  dirty?: boolean
}): DocumentStats {
  const words = countWords(document.content)
  return {
    words,
    characters: document.content.length,
    charactersNoSpaces: document.content.replace(/\s/g, '').length,
    readTimeMinutes: estimateReadTime(words),
    headingCount: deriveHeadings(document.content).length,
    tagCount: document.tags.length,
    pathLabel: pathLabelFromPath(document.path),
  }
}
