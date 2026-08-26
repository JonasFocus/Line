import { describe, expect, it } from 'vitest'

import {
  clampPaneWidths,
  DEFAULT_PANE_WIDTHS,
  loadPaneWidths,
  MIN_PANE_WIDTHS,
  MIN_WORKSPACE_WIDTH,
  PANE_STORAGE_KEY,
  resizePane,
  restorePaneWidths,
  savePaneWidths,
  type PaneWidths,
} from '../src/paneLayout'

const wideShell = 1600
const open = { inspectorOpen: true, focusMode: false }
const inspectorHidden = { inspectorOpen: false, focusMode: false }
const focus = { inspectorOpen: true, focusMode: true }

describe('restorePaneWidths', () => {
  it('returns defaults when storage is missing', () => {
    expect(restorePaneWidths(null)).toEqual(DEFAULT_PANE_WIDTHS)
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-object root', JSON.stringify(['sidebar'])],
    ['a null root', 'null'],
    ['missing pane keys', JSON.stringify({ sidebar: 260, library: 280 })],
    ['non-finite numbers', JSON.stringify({ sidebar: 260, library: 280, inspector: null })],
  ])('falls back for %s', (_case, stored) => {
    expect(restorePaneWidths(stored)).toEqual(DEFAULT_PANE_WIDTHS)
  })

  it('restores finite stored widths', () => {
    const stored: PaneWidths = { sidebar: 220, library: 310, inspector: 280 }
    expect(restorePaneWidths(JSON.stringify(stored))).toEqual(stored)
  })
})

describe('clampPaneWidths', () => {
  it('clamps each pane up to its minimum width', () => {
    expect(clampPaneWidths(
      { sidebar: 50, library: 10, inspector: 0 },
      DEFAULT_PANE_WIDTHS,
      wideShell,
      open,
    )).toEqual(MIN_PANE_WIDTHS)
  })

  it('shrinks the resized pane so the workspace keeps its minimum width', () => {
    expect(clampPaneWidths({ library: 900 }, DEFAULT_PANE_WIDTHS, wideShell, open)).toEqual({
      sidebar: 260,
      library: wideShell - MIN_WORKSPACE_WIDTH - 260 - 300,
      inspector: 300,
    })
  })

  it('stores inspector width without subtracting it when the inspector is closed', () => {
    expect(clampPaneWidths(
      { library: 1200, inspector: 800 },
      DEFAULT_PANE_WIDTHS,
      wideShell,
      inspectorHidden,
    )).toEqual({
      sidebar: 260,
      library: wideShell - MIN_WORKSPACE_WIDTH - 260,
      inspector: 800,
    })
  })

  it('ignores sidebar and library occupancy in focus mode', () => {
    expect(clampPaneWidths(
      { sidebar: 900, library: 900, inspector: 1400 },
      DEFAULT_PANE_WIDTHS,
      wideShell,
      focus,
    )).toEqual({
      sidebar: 900,
      library: 900,
      inspector: wideShell - MIN_WORKSPACE_WIDTH,
    })
  })
})

describe('resizePane', () => {
  it('grows sidebar and library to the right', () => {
    expect(resizePane(DEFAULT_PANE_WIDTHS, 'sidebar', 40, wideShell, open)).toEqual({
      ...DEFAULT_PANE_WIDTHS,
      sidebar: 300,
    })
    expect(resizePane(DEFAULT_PANE_WIDTHS, 'library', 40, wideShell, open)).toEqual({
      ...DEFAULT_PANE_WIDTHS,
      library: 320,
    })
  })

  it('shrinks the inspector when its left edge is dragged right', () => {
    expect(resizePane(DEFAULT_PANE_WIDTHS, 'inspector', 40, wideShell, open)).toEqual({
      ...DEFAULT_PANE_WIDTHS,
      inspector: 260,
    })
    expect(resizePane(DEFAULT_PANE_WIDTHS, 'inspector', -40, wideShell, open)).toEqual({
      ...DEFAULT_PANE_WIDTHS,
      inspector: 340,
    })
  })
})

describe('loadPaneWidths', () => {
  it('falls back when browser storage is unavailable', () => {
    const storage = {
      getItem() {
        throw new Error('Storage access denied')
      },
    }

    expect(loadPaneWidths(() => storage)).toEqual(DEFAULT_PANE_WIDTHS)
  })

  it('falls back when the browser storage accessor is unavailable', () => {
    expect(loadPaneWidths(() => {
      throw new Error('Storage accessor denied')
    })).toEqual(DEFAULT_PANE_WIDTHS)
  })

  it('reads the versioned pane key', () => {
    const stored: PaneWidths = { sidebar: 200, library: 240, inspector: 260 }
    const storage = {
      getItem(key: string) {
        expect(key).toBe(PANE_STORAGE_KEY)
        return JSON.stringify(stored)
      },
    }

    expect(loadPaneWidths(() => storage)).toEqual(stored)
  })
})

describe('savePaneWidths', () => {
  it('stores the latest widths under the versioned pane key', () => {
    let storedKey = ''
    let storedValue = ''
    const widths: PaneWidths = { sidebar: 200, library: 240, inspector: 260 }

    expect(savePaneWidths(() => ({
      setItem: (key, value) => {
        storedKey = key
        storedValue = value
      },
    }), widths)).toBe(true)
    expect(storedKey).toBe(PANE_STORAGE_KEY)
    expect(JSON.parse(storedValue)).toEqual(widths)
  })

  it('reports storage failures', () => {
    expect(savePaneWidths(() => ({
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }), DEFAULT_PANE_WIDTHS)).toBe(false)
  })

  it('reports storage accessor failures', () => {
    expect(savePaneWidths(() => {
      throw new Error('storage access denied')
    }, DEFAULT_PANE_WIDTHS)).toBe(false)
  })
})
