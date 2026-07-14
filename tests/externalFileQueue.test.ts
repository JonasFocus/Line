import { describe, expect, it } from 'vitest'

import { ExternalFileQueue } from '../electron/externalFileQueue'

describe('ExternalFileQueue', () => {
  it('holds cold-launch files until the renderer is ready', () => {
    const queue = new ExternalFileQueue()

    expect(queue.accept(['/tmp/first.md', '/tmp/first.md', '/tmp/second.txt'])).toEqual([])
    expect(queue.markRendererReady()).toEqual(['/tmp/first.md', '/tmp/second.txt'])
    expect(queue.markRendererReady()).toEqual([])
  })

  it('delivers files immediately after readiness', () => {
    const queue = new ExternalFileQueue()
    queue.markRendererReady()

    expect(queue.accept(['/tmp/open.md', '/tmp/open.md'])).toEqual(['/tmp/open.md'])
  })

  it('queues files again while a replacement renderer starts', () => {
    const queue = new ExternalFileQueue()
    queue.markRendererReady()
    queue.resetRenderer()

    expect(queue.accept(['/tmp/reopened.markdown'])).toEqual([])
    expect(queue.markRendererReady()).toEqual(['/tmp/reopened.markdown'])
  })
})
