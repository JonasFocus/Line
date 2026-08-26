import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  loadWindowState,
  parseWindowState,
  restoreWindowState,
  saveWindowState,
  toWindowState,
  type WindowBounds,
  type WindowState,
} from '../electron/windowState'

const workArea: WindowBounds = {
  x: 0,
  y: 25,
  width: 1920,
  height: 1055,
}

function validState(
  overrides: Partial<WindowState> = {},
): WindowState {
  return {
    x: 120,
    y: 80,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    isMaximized: false,
    ...overrides,
  }
}

describe('parseWindowState', () => {
  it('returns null for invalid JSON', () => {
    expect(parseWindowState('{')).toBeNull()
    expect(parseWindowState('')).toBeNull()
    expect(parseWindowState('undefined')).toBeNull()
  })

  it('returns null for non-object payloads', () => {
    expect(parseWindowState('null')).toBeNull()
    expect(parseWindowState('[]')).toBeNull()
    expect(parseWindowState('"window"')).toBeNull()
    expect(parseWindowState('1520')).toBeNull()
  })

  it('returns null when required numbers are missing or the wrong type', () => {
    expect(
      parseWindowState(
        JSON.stringify({ y: 80, width: 1520, height: 960, isMaximized: false }),
      ),
    ).toBeNull()
    expect(
      parseWindowState(
        JSON.stringify({
          x: '120',
          y: 80,
          width: 1520,
          height: 960,
          isMaximized: false,
        }),
      ),
    ).toBeNull()
    expect(
      parseWindowState(
        JSON.stringify({
          x: null,
          y: 80,
          width: 1520,
          height: 960,
          isMaximized: false,
        }),
      ),
    ).toBeNull()
  })

  it('rejects Infinity encoded as JSON numbers', () => {
    expect(
      parseWindowState(
        '{"x":0,"y":0,"width":1e999,"height":960,"isMaximized":false}',
      ),
    ).toBeNull()
    expect(
      parseWindowState(
        '{"x":-1e999,"y":0,"width":1520,"height":960,"isMaximized":false}',
      ),
    ).toBeNull()
  })

  it('parses a valid saved state', () => {
    expect(parseWindowState(JSON.stringify(validState({ isMaximized: true })))).toEqual(
      validState({ isMaximized: true }),
    )
  })

  it('treats a missing maximize flag as false', () => {
    const { isMaximized: _ignored, ...withoutFlag } = validState()
    expect(parseWindowState(JSON.stringify(withoutFlag))).toEqual(
      validState({ isMaximized: false }),
    )
  })
})

describe('toWindowState', () => {
  it('rejects NaN and Infinity', () => {
    expect(toWindowState(validState({ x: Number.NaN }))).toBeNull()
    expect(toWindowState(validState({ y: Number.POSITIVE_INFINITY }))).toBeNull()
    expect(toWindowState(validState({ width: Number.NEGATIVE_INFINITY }))).toBeNull()
    expect(toWindowState(validState({ height: Number.NaN }))).toBeNull()
  })
})

describe('restoreWindowState', () => {
  it('clamps width and height to the minimum size', () => {
    expect(
      restoreWindowState(
        validState({ width: 200, height: 100 }),
        workArea,
      ),
    ).toEqual(
      validState({
        width: MIN_WINDOW_WIDTH,
        height: MIN_WINDOW_HEIGHT,
      }),
    )
  })

  it('clamps width and height to the work area', () => {
    expect(
      restoreWindowState(
        validState({ width: 4000, height: 3000 }),
        workArea,
      ),
    ).toEqual(
      validState({
        width: workArea.width,
        height: workArea.height,
      }),
    )
  })

  it('keeps a window that still overlaps the work area', () => {
    const saved = validState({
      x: workArea.x + workArea.width - 80,
      y: workArea.y + 40,
    })

    expect(restoreWindowState(saved, workArea)).toEqual(saved)
  })

  it('recenters a fully off-screen window using the saved size', () => {
    const saved = validState({ x: 8000, y: -4000 })

    expect(restoreWindowState(saved, workArea)).toEqual(
      validState({
        x: Math.round(workArea.x + (workArea.width - saved.width) / 2),
        y: Math.round(workArea.y + (workArea.height - saved.height) / 2),
      }),
    )
  })

  it('recenters an off-screen window after clamping to the minimum size', () => {
    const restored = restoreWindowState(
      validState({ x: -4000, y: -4000, width: 10, height: 10 }),
      workArea,
    )

    expect(restored).toEqual({
      x: Math.round(workArea.x + (workArea.width - MIN_WINDOW_WIDTH) / 2),
      y: Math.round(workArea.y + (workArea.height - MIN_WINDOW_HEIGHT) / 2),
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT,
      isMaximized: false,
    })
  })

  it('preserves the maximize flag', () => {
    expect(
      restoreWindowState(validState({ isMaximized: true }), workArea).isMaximized,
    ).toBe(true)
  })
})

describe('loadWindowState and saveWindowState', () => {
  it('returns null when the file cannot be read', () => {
    expect(
      loadWindowState(
        '/missing/window-state.json',
        () => workArea,
        () => {
          throw new Error('ENOENT')
        },
      ),
    ).toBeNull()
  })

  it('returns null when the file contents cannot be parsed', () => {
    expect(
      loadWindowState(
        '/tmp/window-state.json',
        () => workArea,
        () => '{not json',
      ),
    ).toBeNull()
  })

  it('loads, clamps, and restores a saved maximized window', () => {
    const files = new Map<string, string>()
    const filePath = '/tmp/window-state.json'

    saveWindowState(
      filePath,
      { x: 40, y: 60, width: 5000, height: 20 },
      true,
      (targetPath, contents) => {
        files.set(targetPath, contents)
      },
    )

    expect(files.get(filePath)).toBe(
      JSON.stringify({
        x: 40,
        y: 60,
        width: 5000,
        height: 20,
        isMaximized: true,
      }),
    )

    expect(
      loadWindowState(
        filePath,
        () => workArea,
        (targetPath) => {
          const contents = files.get(targetPath)
          if (contents === undefined) throw new Error('ENOENT')
          return contents
        },
      ),
    ).toEqual({
      x: 40,
      y: 60,
      width: workArea.width,
      height: MIN_WINDOW_HEIGHT,
      isMaximized: true,
    })
  })

  it('does not write invalid bounds', () => {
    const files = new Map<string, string>()

    saveWindowState(
      '/tmp/window-state.json',
      { x: Number.NaN, y: 60, width: 1520, height: 960 },
      false,
      (targetPath, contents) => {
        files.set(targetPath, contents)
      },
    )

    expect(files.size).toBe(0)
  })
})
