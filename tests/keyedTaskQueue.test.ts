import { describe, expect, it } from 'vitest'

import { KeyedTaskQueue } from '../electron/keyedTaskQueue'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

describe('KeyedTaskQueue', () => {
  it('runs tasks for the same key in submission order', async () => {
    const queue = new KeyedTaskQueue()
    const releaseFirst = deferred<void>()
    const firstStarted = deferred<void>()
    const events: string[] = []

    const first = queue.run('/tmp/note.md', async () => {
      events.push('first:start')
      firstStarted.resolve()
      await releaseFirst.promise
      events.push('first:end')
      return 'first'
    })
    const second = queue.run('/tmp/note.md', async () => {
      events.push('second:start')
      return 'second'
    })

    await firstStarted.promise
    expect(events).toEqual(['first:start'])

    releaseFirst.resolve()
    await expect(Promise.all([first, second])).resolves.toEqual([
      'first',
      'second',
    ])
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
  })

  it('does not block tasks for different keys', async () => {
    const queue = new KeyedTaskQueue()
    const firstStarted = deferred<void>()
    const secondStarted = deferred<void>()
    const release = deferred<void>()

    const first = queue.run('/tmp/first.md', async () => {
      firstStarted.resolve()
      await release.promise
    })
    const second = queue.run('/tmp/second.md', async () => {
      secondStarted.resolve()
      await release.promise
    })

    await Promise.all([firstStarted.promise, secondStarted.promise])
    release.resolve()
    await Promise.all([first, second])
  })

  it('continues queued work after an earlier task fails', async () => {
    const queue = new KeyedTaskQueue()
    const failure = new Error('disk full')

    const first = queue.run('/tmp/note.md', async () => {
      throw failure
    })
    const second = queue.run('/tmp/note.md', async () => 'saved')

    await expect(first).rejects.toBe(failure)
    await expect(second).resolves.toBe('saved')
  })
})
