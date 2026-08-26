export const DEFAULT_WINDOW_WIDTH = 1520
export const DEFAULT_WINDOW_HEIGHT = 960
export const MIN_WINDOW_WIDTH = 1040
export const MIN_WINDOW_HEIGHT = 680

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState extends WindowBounds {
  isMaximized: boolean
}

export type ReadWindowStateFile = (filePath: string) => string
export type WriteWindowStateFile = (filePath: string, contents: string) => void
export type WorkAreaForSavedState = (saved: WindowState) => WindowBounds

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function rectanglesOverlap(a: WindowBounds, b: WindowBounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function centerOnWorkArea(size: WindowBounds, workArea: WindowBounds): WindowBounds {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + (workArea.height - size.height) / 2),
    width: size.width,
    height: size.height,
  }
}

export function toWindowState(value: unknown): WindowState | null {
  if (!isRecord(value)) return null
  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height)
  ) {
    return null
  }

  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    isMaximized: value.isMaximized === true,
  }
}

export function parseWindowState(raw: string): WindowState | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return toWindowState(parsed)
  } catch {
    return null
  }
}

export function restoreWindowState(
  saved: WindowState,
  workArea: WindowBounds,
): WindowState {
  const width = clamp(
    saved.width,
    MIN_WINDOW_WIDTH,
    Math.max(workArea.width, MIN_WINDOW_WIDTH),
  )
  const height = clamp(
    saved.height,
    MIN_WINDOW_HEIGHT,
    Math.max(workArea.height, MIN_WINDOW_HEIGHT),
  )
  const bounds: WindowBounds = {
    x: saved.x,
    y: saved.y,
    width,
    height,
  }

  if (!rectanglesOverlap(bounds, workArea)) {
    return {
      ...centerOnWorkArea(bounds, workArea),
      isMaximized: saved.isMaximized,
    }
  }

  return {
    ...bounds,
    isMaximized: saved.isMaximized,
  }
}

export function serializeWindowState(state: WindowState): string {
  return JSON.stringify({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    isMaximized: state.isMaximized,
  })
}

export function loadWindowState(
  filePath: string,
  getWorkArea: WorkAreaForSavedState,
  readTextFile: ReadWindowStateFile,
): WindowState | null {
  let raw: string
  try {
    raw = readTextFile(filePath)
  } catch {
    return null
  }

  const parsed = parseWindowState(raw)
  if (!parsed) return null
  return restoreWindowState(parsed, getWorkArea(parsed))
}

export function saveWindowState(
  filePath: string,
  bounds: WindowBounds,
  isMaximized: boolean,
  writeTextFile: WriteWindowStateFile,
): void {
  const state = toWindowState({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  })
  if (!state) return

  writeTextFile(filePath, serializeWindowState(state))
}
