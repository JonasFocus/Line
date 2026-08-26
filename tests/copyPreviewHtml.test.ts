import { describe, expect, it } from 'vitest'

import { previewHtmlForClipboard } from '../src/copyPreviewHtml'

describe('previewHtmlForClipboard', () => {
  it('returns an empty string for empty markdown', () => {
    expect(previewHtmlForClipboard('')).toBe('')
  })

  it('renders a heading as h1', () => {
    expect(previewHtmlForClipboard('# Hello')).toBe('<h1 id="hello">Hello</h1>')
  })
})
