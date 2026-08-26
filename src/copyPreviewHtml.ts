import { renderMarkdown } from './lib'

export function previewHtmlForClipboard(markdown: string): string {
  if (!markdown) return ''
  return renderMarkdown(markdown)
}
