export interface LatestTaskResult<T> {
  continueWithPending: boolean
  updatePending?: (pending: T) => T
}

export class LatestTaskQueue<T> {
  private readonly pending = new Map<string, T>()
  private readonly running = new Set<string>()

  async run(
    key: string,
    request: T,
    task: (request: T) => Promise<LatestTaskResult<T>>,
  ): Promise<void> {
    if (this.running.has(key)) {
      this.pending.set(key, request)
      return
    }

    this.running.add(key)
    let current = request
    try {
      while (true) {
        const result = await task(current)
        if (!result.continueWithPending) {
          this.pending.delete(key)
          return
        }

        const pending = this.pending.get(key)
        this.pending.delete(key)
        if (!pending) return
        current = result.updatePending ? result.updatePending(pending) : pending
      }
    } finally {
      this.running.delete(key)
    }
  }
}
