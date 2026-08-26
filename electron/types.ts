export const IPC_CHANNELS = {
  createBlank: 'line:documents:create-blank',
  chooseOpenFiles: 'line:documents:choose-open-files',
  readOpenFiles: 'line:documents:read-open-files',
  openFiles: 'line:documents:open-files',
  saveFile: 'line:documents:save-file',
  chooseSaveFileAs: 'line:documents:choose-save-file-as',
  saveFileAs: 'line:documents:save-file-as',
  revealInFolder: 'line:documents:reveal-in-folder',
  platformInfo: 'line:app:platform-info',
  rendererReady: 'line:app:renderer-ready',
  menuCommand: 'line:menu:command',
  externalFilesOpened: 'line:documents:external-files-opened',
  externalOpenFailed: 'line:documents:external-open-failed',
  prepareClose: 'line:app:prepare-close',
  prepareCloseFinished: 'line:app:prepare-close-finished',
} as const

export type MenuCommand =
  | 'new'
  | 'duplicate'
  | 'open'
  | 'save'
  | 'save-as'
  | 'reveal-in-folder'
  | 'copy-html'
  | 'edit-mode'
  | 'split-mode'
  | 'preview-mode'
  | 'toggle-inspector'
export type PrepareCloseAction = 'save' | 'preserve'

export interface LineDocument {
  id: string
  path: string | null
  name: string
  content: string
  modifiedAt: string | null
  revision: string
}

export interface OpenFilesOptions {
  multiple?: boolean
}

/** File → Open result: successes plus an optional banner message for bad files. */
export interface OpenFilesResult {
  documents: LineDocument[]
  error?: string
}

export interface SaveFileInput {
  path: string
  content: string
  /** When set, conflict-check before overwrite. Omit for a newly chosen Save As path. */
  expectedRevision?: string
}

export interface SaveFileAsInput {
  content: string
  currentPath?: string | null
  defaultToDocuments?: boolean
  suggestedName?: string
  saveCopy?: boolean
  expectedRevision?: string | null
}

export interface PlatformInfo {
  platform: string
  architecture: string
  isMac: boolean
  versions: {
    chrome: string
    electron: string
    node: string
  }
}

export interface LineApi {
  createBlankDocument(): Promise<LineDocument>
  createDocument(): Promise<LineDocument>
  chooseOpenFiles(options?: OpenFilesOptions): Promise<string[]>
  readOpenFiles(filePaths: string[]): Promise<OpenFilesResult>
  openFiles(options?: OpenFilesOptions): Promise<OpenFilesResult>
  importMarkdown(): Promise<LineDocument | null>
  saveFile(input: SaveFileInput): Promise<LineDocument>
  chooseSaveFileAs(input: SaveFileAsInput): Promise<string | null>
  saveFileAs(input: SaveFileAsInput): Promise<LineDocument | null>
  revealInFolder(filePath: string): Promise<boolean>
  saveDocument(
    input: SaveFileAsInput & {
      path?: string | null
      expectedRevision?: string | null
    },
  ): Promise<LineDocument | null>
  getPlatformInfo(): Promise<PlatformInfo>
  readyForExternalFiles(): Promise<LineDocument[]>
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
  onShortcut(callback: (command: MenuCommand) => void): () => void
  onExternalFilesOpened(
    callback: (documents: LineDocument[]) => void,
  ): () => void
  onExternalOpenFailed(callback: (message: string) => void): () => void
  onPrepareClose(callback: (action: PrepareCloseAction) => void): () => void
  finishPrepareClose(success: boolean): void
}
