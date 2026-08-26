export const PANE_STORAGE_KEY = 'line.panes.v1'

export type PaneWidths = {
  sidebar: number
  library: number
  inspector: number
}

export const DEFAULT_PANE_WIDTHS: PaneWidths = { sidebar: 260, library: 280, inspector: 300 }

export const MIN_PANE_WIDTHS: PaneWidths = { sidebar: 180, library: 200, inspector: 240 }
export const MIN_WORKSPACE_WIDTH = 420

type PaneKey = keyof PaneWidths
type PaneLayoutOptions = { inspectorOpen: boolean; focusMode: boolean }

const PANE_KEYS: readonly PaneKey[] = ['sidebar', 'library', 'inspector']

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback
}

function visibleChromePanes(options: PaneLayoutOptions): PaneKey[] {
  if (options.focusMode) {
    return options.inspectorOpen ? ['inspector'] : []
  }

  return options.inspectorOpen ? ['sidebar', 'library', 'inspector'] : ['sidebar', 'library']
}

function occupiedChromeWidth(widths: PaneWidths, options: PaneLayoutOptions): number {
  return visibleChromePanes(options).reduce((total, key) => total + widths[key], 0)
}

function resizedPaneKey(next: Partial<PaneWidths>): PaneKey | null {
  const keys = PANE_KEYS.filter((key) => next[key] !== undefined)
  return keys.length === 1 ? keys[0] : null
}

export function clampPaneWidths(
  next: Partial<PaneWidths>,
  current: PaneWidths,
  shellWidth: number,
  options: PaneLayoutOptions,
): PaneWidths {
  const merged: PaneWidths = {
    sidebar: Math.max(
      MIN_PANE_WIDTHS.sidebar,
      finiteOr(next.sidebar, finiteOr(current.sidebar, DEFAULT_PANE_WIDTHS.sidebar)),
    ),
    library: Math.max(
      MIN_PANE_WIDTHS.library,
      finiteOr(next.library, finiteOr(current.library, DEFAULT_PANE_WIDTHS.library)),
    ),
    inspector: Math.max(
      MIN_PANE_WIDTHS.inspector,
      finiteOr(next.inspector, finiteOr(current.inspector, DEFAULT_PANE_WIDTHS.inspector)),
    ),
  }

  const overflow = occupiedChromeWidth(merged, options) + MIN_WORKSPACE_WIDTH - shellWidth
  if (!(overflow > 0)) return merged

  const resized = resizedPaneKey(next)
  const visible = visibleChromePanes(options)
  const target = resized && visible.includes(resized) ? resized : visible[visible.length - 1]
  if (!target) return merged

  return {
    ...merged,
    [target]: Math.max(MIN_PANE_WIDTHS[target], merged[target] - overflow),
  }
}

export function resizePane(
  current: PaneWidths,
  key: PaneKey,
  deltaX: number,
  shellWidth: number,
  options: PaneLayoutOptions,
): PaneWidths {
  const delta = isFiniteNumber(deltaX) ? deltaX : 0
  // Inspector's handle is its left edge, so a rightward drag shrinks it.
  const applied = key === 'inspector' ? -delta : delta
  return clampPaneWidths(
    { [key]: finiteOr(current[key], DEFAULT_PANE_WIDTHS[key]) + applied },
    current,
    shellWidth,
    options,
  )
}

export function restorePaneWidths(stored: string | null): PaneWidths {
  const fallback = { ...DEFAULT_PANE_WIDTHS }
  if (!stored) return fallback

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed)) return fallback
    if (
      !isFiniteNumber(parsed.sidebar) ||
      !isFiniteNumber(parsed.library) ||
      !isFiniteNumber(parsed.inspector)
    ) {
      return fallback
    }

    return {
      sidebar: parsed.sidebar,
      library: parsed.library,
      inspector: parsed.inspector,
    }
  } catch {
    return fallback
  }
}

export function loadPaneWidths(getStorage: () => Pick<Storage, 'getItem'>): PaneWidths {
  try {
    const storage = getStorage()
    return restorePaneWidths(storage.getItem(PANE_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_PANE_WIDTHS }
  }
}

export function savePaneWidths(
  getStorage: () => Pick<Storage, 'setItem'>,
  widths: PaneWidths,
): boolean {
  try {
    const storage = getStorage()
    storage.setItem(PANE_STORAGE_KEY, JSON.stringify(widths))
    return true
  } catch {
    return false
  }
}
