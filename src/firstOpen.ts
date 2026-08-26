export const FIRST_OPEN_STORAGE_KEY = 'line.onboarding.v1'
export const WRITER_NAME_MAX_LENGTH = 40

export type FirstOpenSlide = 0 | 1 | 2

export type FirstOpenRecord = {
  completed: true
  name: string
}

export function normalizeWriterName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, WRITER_NAME_MAX_LENGTH)
}

export function restoreFirstOpen(stored: string | null): FirstOpenRecord | null {
  if (!stored) return null

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    if (record.completed !== true) return null

    const name = typeof record.name === 'string' ? normalizeWriterName(record.name) : ''
    if (!name) return null

    return { completed: true, name }
  } catch {
    return null
  }
}

export function shouldShowFirstOpen(record: FirstOpenRecord | null): boolean {
  return record === null
}

export function nextFirstOpenSlide(slide: FirstOpenSlide): FirstOpenSlide {
  if (slide >= 2) return 2
  return (slide + 1) as FirstOpenSlide
}

export function previousFirstOpenSlide(slide: FirstOpenSlide): FirstOpenSlide {
  if (slide <= 0) return 0
  return (slide - 1) as FirstOpenSlide
}

export function loadFirstOpen(
  getStorage: () => Pick<Storage, 'getItem'>,
): FirstOpenRecord | null {
  try {
    return restoreFirstOpen(getStorage().getItem(FIRST_OPEN_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveFirstOpen(
  getStorage: () => Pick<Storage, 'setItem'>,
  name: string,
): boolean {
  const normalized = normalizeWriterName(name)
  if (!normalized) return false

  try {
    getStorage().setItem(
      FIRST_OPEN_STORAGE_KEY,
      JSON.stringify({ completed: true, name: normalized } satisfies FirstOpenRecord),
    )
    return true
  } catch {
    return false
  }
}
