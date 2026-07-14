import { describe, expect, it } from 'vitest'

import { LatestTaskQueue } from '../src/latestTaskQueue'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('LatestTaskQueue', () => {
  it('runs the latest pending request after the active task', async () => {
    const queue = new LatestTaskQueue<{ content: string; revision: string }>()
    const firstStarted = deferred<void>()
    const releaseFirst = deferred<void>()
    const saved: string[] = []
    const task = async (request: { content: string; revision: string }) => {
      saved.push(`${request.revision}:${request.content}`)
      if (request.content === 'first') {
        firstStarted.resolve()
        await releaseFirst.promise
      }
      return {
        continueWithPending: true,
        updatePending: (pending: { content: string; revision: string }) => ({
          ...pending,
          revision: `saved-${request.content}`,
        }),
      }
    }

    const first = queue.run('note', { content: 'first', revision: 'opened' }, task)
    await firstStarted.promise
    await queue.run('note', { content: 'second', revision: 'opened' }, task)
    await queue.run('note', { content: 'latest', revision: 'opened' }, task)
    releaseFirst.resolve()
    await first

    expect(saved).toEqual(['opened:first', 'saved-first:latest'])
  })

  it('discards pending work when the active task cannot continue', async () => {
    const queue = new LatestTaskQueue<string>()
    const started = deferred<void>()
    const release = deferred<void>()
    const saved: string[] = []
    const first = queue.run('note', 'first', async (request) => {
      saved.push(request)
      started.resolve()
      await release.promise
      return { continueWithPending: false }
    })
    await started.promise
    await queue.run('note', 'pending', async () => {
      throw new Error('pending task should not run')
    })
    release.resolve()
    await first

    expect(saved).toEqual(['first'])
  })

  it('does not block work for different keys', async () => {
    const queue = new LatestTaskQueue<string>()
    const release = deferred<void>()
    const started: string[] = []
    const task = async (request: string) => {
      started.push(request)
      await release.promise
      return { continueWithPending: true }
    }

    const first = queue.run('first', 'first', task)
    const second = queue.run('second', 'second', task)
    await Promise.resolve()
    expect(started).toEqual(['first', 'second'])
    release.resolve()
    await Promise.all([first, second])
  })
})
