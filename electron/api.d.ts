import type { LineApi } from './types'

declare global {
  interface Window {
    line: LineApi
  }
}

export {}
