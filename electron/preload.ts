import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type LineApi,
  type LineDocument,
  type MenuCommand,
  type OpenFilesOptions,
  type PlatformInfo,
  type SaveFileAsInput,
  type SaveFileInput,
} from './types'

function subscribe<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => {
    callback(payload)
  }

  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const createBlankDocument = () =>
  ipcRenderer.invoke(IPC_CHANNELS.createBlank) as Promise<LineDocument>

const openFiles = (options?: OpenFilesOptions) =>
  ipcRenderer.invoke(
    IPC_CHANNELS.openFiles,
    options,
  ) as Promise<LineDocument[]>

const saveFile = (input: SaveFileInput) =>
  ipcRenderer.invoke(IPC_CHANNELS.saveFile, input) as Promise<LineDocument>

const saveFileAs = (input: SaveFileAsInput) =>
  ipcRenderer.invoke(
    IPC_CHANNELS.saveFileAs,
    input,
  ) as Promise<LineDocument | null>

const api: LineApi = Object.freeze({
  createBlankDocument,
  createDocument: createBlankDocument,
  openFiles,
  importMarkdown: async () => {
    const [document] = await openFiles({ multiple: false })
    return document ?? null
  },
  saveFile,
  saveFileAs,
  saveDocument: (
    input: SaveFileAsInput & { path?: string | null },
  ) => {
    if (input.path) {
      return saveFile({ path: input.path, content: input.content })
    }

    return saveFileAs(input)
  },
  getPlatformInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.platformInfo) as Promise<PlatformInfo>,
  onMenuCommand: (callback: (command: MenuCommand) => void) =>
    subscribe<MenuCommand>(IPC_CHANNELS.menuCommand, callback),
  onShortcut: (callback: (command: MenuCommand) => void) =>
    subscribe<MenuCommand>(IPC_CHANNELS.menuCommand, callback),
  onExternalFilesOpened: (callback: (documents: LineDocument[]) => void) =>
    subscribe<LineDocument[]>(IPC_CHANNELS.externalFilesOpened, callback),
})

contextBridge.exposeInMainWorld('line', api)
