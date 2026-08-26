import type { LineDocument } from './lineDocument'

export type LibrarySort = 'recent' | 'title' | 'starred'

export const LIBRARY_SORT_STORAGE_KEY = 'line.librarySort.v1'

const LIBRARY_SORTS: readonly LibrarySort[] = ['recent', 'title', 'starred']

const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = {
  recent: 'Sort: Recent',
  title: 'Sort: Title',
  starred: 'Sort: Starred',
}

export function isLibrarySort(value: unknown): value is LibrarySort {
  return value === 'recent' || value === 'title' || value === 'starred'
}

export function librarySortLabel(sort: LibrarySort): string {
  return LIBRARY_SORT_LABELS[sort]
}

export function cycleLibrarySort(sort: LibrarySort): LibrarySort {
  const index = LIBRARY_SORTS.indexOf(sort)
  return LIBRARY_SORTS[(index + 1) % LIBRARY_SORTS.length]
}

function sortableTitle(document: LineDocument): string {
  return document.title || 'Untitled'
}

function sortableTime(document: LineDocument): number {
  const time = document.updatedAtMs
  return typeof time === 'number' && Number.isFinite(time) ? time : 0
}

function compareByRecent(
  left: { document: LineDocument; index: number },
  right: { document: LineDocument; index: number },
): number {
  const timeDelta = sortableTime(right.document) - sortableTime(left.document)
  if (timeDelta !== 0) return timeDelta
  return left.index - right.index
}

export function sortDocuments(
  documents: readonly LineDocument[],
  sort: LibrarySort,
): LineDocument[] {
  return documents
    .map((document, index) => ({ document, index }))
    .sort((left, right) => {
      if (sort === 'title') {
        const titleDelta = sortableTitle(left.document).localeCompare(sortableTitle(right.document))
        if (titleDelta !== 0) return titleDelta
      }

      if (sort === 'starred') {
        const favoriteDelta = Number(right.document.favorite) - Number(left.document.favorite)
        if (favoriteDelta !== 0) return favoriteDelta
      }

      return compareByRecent(left, right)
    })
    .map((entry) => entry.document)
}

export function loadLibrarySort(getStorage: () => Pick<Storage, 'getItem'>): LibrarySort {
  try {
    const stored = getStorage().getItem(LIBRARY_SORT_STORAGE_KEY)
    return isLibrarySort(stored) ? stored : 'recent'
  } catch {
    return 'recent'
  }
}

export function saveLibrarySort(
  getStorage: () => Pick<Storage, 'setItem'>,
  sort: LibrarySort,
): boolean {
  try {
    getStorage().setItem(LIBRARY_SORT_STORAGE_KEY, sort)
    return true
  } catch {
    return false
  }
}
