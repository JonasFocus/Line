import path from 'node:path'

export const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

export interface ExternalOpenFailure {
  filePath: string
  message: string
}

/** True when argv entry looks like a user document path, not an Electron/runtime flag. */
export function isCandidateExternalFileArg(arg: string): boolean {
  if (!arg || arg.startsWith('-')) return false
  return SUPPORTED_EXTENSIONS.has(path.extname(arg).toLowerCase())
}

/**
 * Collect supported document paths from a process argv (cold start or second-instance).
 * Skips flags, the Electron/binary entry, and non-supported extensions.
 */
export function collectExternalFilePathsFromArgv(
  argv: readonly string[],
  options: {
    resolvePath?: (filePath: string) => string
    ignorePaths?: ReadonlySet<string>
  } = {},
): string[] {
  const resolvePath = options.resolvePath ?? ((filePath: string) => path.resolve(filePath))
  const ignorePaths = options.ignorePaths ?? new Set<string>()
  const collected: string[] = []
  const seen = new Set<string>()

  for (const arg of argv) {
    if (!isCandidateExternalFileArg(arg)) continue
    const normalized = resolvePath(arg)
    if (ignorePaths.has(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    collected.push(normalized)
  }

  return collected
}

export function formatExternalOpenError(failures: readonly ExternalOpenFailure[]): string {
  if (failures.length === 0) {
    return 'Could not open the file.'
  }

  if (failures.length === 1) {
    const failure = failures[0]
    const name = path.basename(failure.filePath) || failure.filePath
    return `Could not open ${name}: ${failure.message}`
  }

  const preview = failures
    .slice(0, 3)
    .map((failure) => path.basename(failure.filePath) || failure.filePath)
    .join(', ')
  const remaining = failures.length - Math.min(failures.length, 3)
  const suffix = remaining > 0 ? `, and ${remaining} more` : ''
  return `Could not open ${failures.length} files (${preview}${suffix}).`
}

export function partitionExternalOpenResults<T>(
  results: ReadonlyArray<{ filePath: string; document?: T; error?: unknown }>,
): { documents: T[]; failures: ExternalOpenFailure[] } {
  const documents: T[] = []
  const failures: ExternalOpenFailure[] = []

  for (const result of results) {
    if (result.document !== undefined) {
      documents.push(result.document)
      continue
    }

    const message =
      result.error instanceof Error
        ? result.error.message
        : typeof result.error === 'string'
          ? result.error
          : 'The file could not be read.'
    failures.push({ filePath: result.filePath, message })
  }

  return { documents, failures }
}

/**
 * Read many paths in parallel. One failure must not abort the others.
 * Used by File → Open and Finder / Dock intake.
 */
export async function settleDocumentReads<T>(
  filePaths: readonly string[],
  readOne: (filePath: string) => Promise<T>,
): Promise<{ documents: T[]; failures: ExternalOpenFailure[] }> {
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return { filePath, document: await readOne(filePath) }
      } catch (error) {
        return { filePath, error }
      }
    }),
  )

  return partitionExternalOpenResults(results)
}

/** Dialog / IPC open payload: keep good documents, attach a banner message for failures. */
export function toOpenFilesResult<T>(
  documents: T[],
  failures: readonly ExternalOpenFailure[],
): { documents: T[]; error?: string } {
  if (failures.length === 0) {
    return { documents }
  }

  return {
    documents,
    error: formatExternalOpenError(failures),
  }
}
