export const IPC_CHANNELS = {
  createBlank: 'line:documents:create-blank',
  openFiles: 'line:documents:open-files',
  saveFile: 'line:documents:save-file',
  saveFileAs: 'line:documents:save-file-as',
  platformInfo: 'line:app:platform-info',
  rendererReady: 'line:app:renderer-ready',
  menuCommand: 'line:menu:command',
  externalFilesOpened: 'line:documents:external-files-opened',
} as const

export type MenuCommand = 'new' | 'open' | 'save' | 'save-as'

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

export interface SaveFileInput {
  path: string
  content: string
  expectedRevision: string
}

export interface SaveFileAsInput {
  content: string
  currentPath?: string | null
  defaultToDocuments?: boolean
  suggestedName?: string
  saveCopy?: boolean
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
  openFiles(options?: OpenFilesOptions): Promise<LineDocument[]>
  importMarkdown(): Promise<LineDocument | null>
  saveFile(input: SaveFileInput): Promise<LineDocument>
  saveFileAs(input: SaveFileAsInput): Promise<LineDocument | null>
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
}
