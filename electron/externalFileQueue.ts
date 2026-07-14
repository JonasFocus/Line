export class ExternalFileQueue {
  private readonly pendingPaths = new Set<string>()
  private rendererReady = false

  accept(filePaths: string[]): string[] {
    const uniquePaths = [...new Set(filePaths)]
    if (this.rendererReady) return uniquePaths

    uniquePaths.forEach((filePath) => this.pendingPaths.add(filePath))
    return []
  }

  markRendererReady(): string[] {
    this.rendererReady = true
    const pendingPaths = [...this.pendingPaths]
    this.pendingPaths.clear()
    return pendingPaths
  }

  resetRenderer(): void {
    this.rendererReady = false
  }
}
