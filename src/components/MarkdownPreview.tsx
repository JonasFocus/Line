import type { MouseEvent } from 'react'
import { deriveHeadings, renderMarkdown } from '../lib'

export interface OutlineItem {
  id: string
  level: number
  text: string
  line: number
}

export function extractOutline(markdown: string): OutlineItem[] {
  return deriveHeadings(markdown).map((heading) => ({
    ...heading,
    line: Math.max(0, heading.line - 1),
  }))
}

interface MarkdownPreviewProps {
  markdown: string
  className?: string
}

function openExternalLink(event: MouseEvent<HTMLElement>) {
  const target = event.target
  if (!(target instanceof Element)) return
  const link = target.closest('a')
  const href = link?.getAttribute('href')
  if (!href || !/^(?:https?:|mailto:)/i.test(href)) return
  event.preventDefault()
  window.open(href, '_blank', 'noopener,noreferrer')
}

export function MarkdownPreview({ markdown, className = '' }: MarkdownPreviewProps) {
  return (
    <article
      className={`markdown-preview ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
      onClick={openExternalLink}
    />
  )
}
