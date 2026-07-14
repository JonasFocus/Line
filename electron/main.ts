import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  IPC_CHANNELS,
  type LineDocument,
  type MenuCommand,
  type OpenFilesOptions,
  type PlatformInfo,
  type SaveFileAsInput,
  type SaveFileInput,
} from './types'
import { ExternalFileQueue } from './externalFileQueue'
import { KeyedTaskQueue } from './keyedTaskQueue'
import {
  atomicWriteFile,
  resolveWriteDestination,
  resolveWriteQueueKey,
} from './atomicWriteFile'
import {
  createDocumentRevision,
  writeFileIfUnchanged,
} from './documentRevision'
import { resolveAvailableCopyPath } from './savePath'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const grantedPaths = new Set<string>()
const externalFileQueue = new ExternalFileQueue()
const documentSaveQueue = new KeyedTaskQueue()

let mainWindow: BrowserWindow | null = null

function normalizePath(filePath: string): string {
  return path.resolve(filePath)
}

function assertSupportedPath(filePath: string): void {
  if (!SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    throw new Error('Line supports .md, .markdown, and .txt files.')
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string.`)
  }
}

async function readDocument(filePath: string): Promise<LineDocument> {
  const normalizedPath = normalizePath(filePath)
  assertSupportedPath(normalizedPath)

  const fileStats = await stat(normalizedPath)
  if (!fileStats.isFile()) {
    throw new Error('The selected item is not a file.')
  }
  if (fileStats.size > MAX_DOCUMENT_BYTES) {
    throw new Error('The selected file is larger than the 10 MB limit.')
  }

  const content = await readFile(normalizedPath, 'utf8')
  grantedPaths.add(normalizedPath)

  return {
    id: normalizedPath,
    path: normalizedPath,
    name: path.basename(normalizedPath),
    content,
    modifiedAt: fileStats.mtime.toISOString(),
    revision: createDocumentRevision(content),
  }
}

function createBlankDocument(): LineDocument {
  return {
    id: randomUUID(),
    path: null,
    name: 'Untitled.md',
    content: '',
    modifiedAt: null,
    revision: createDocumentRevision(''),
  }
}

async function showOpenDialog(
  options: OpenDialogOptions,
): Promise<Electron.OpenDialogReturnValue> {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  return focusedWindow
    ? dialog.showOpenDialog(focusedWindow, options)
    : dialog.showOpenDialog(options)
}

async function showSaveDialog(
  options: SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  return focusedWindow
    ? dialog.showSaveDialog(focusedWindow, options)
    : dialog.showSaveDialog(options)
}

async function openDocuments(
  options: OpenFilesOptions = {},
): Promise<LineDocument[]> {
  const properties: OpenDialogOptions['properties'] = ['openFile']
  if (options.multiple !== false) {
    properties.push('multiSelections')
  }

  const result = await showOpenDialog({
    title: options.multiple === false ? 'Open Document' : 'Open Documents',
    buttonLabel: 'Open',
    properties,
    filters: [
      { name: 'Markdown and text', extensions: ['md', 'markdown', 'txt'] },
    ],
  })

  if (result.canceled) {
    return []
  }

  return Promise.all(result.filePaths.map(readDocument))
}

async function saveDocument(input: SaveFileInput): Promise<LineDocument> {
  assertString(input?.path, 'path')
  assertString(input?.content, 'content')
  assertString(input?.expectedRevision, 'expectedRevision')

  const normalizedPath = normalizePath(input.path)
  assertSupportedPath(normalizedPath)

  if (!grantedPaths.has(normalizedPath)) {
    throw new Error('Save access has not been granted for this file.')
  }

  return writeDocument(
    normalizedPath,
    input.content,
    input.expectedRevision,
  )
}

async function writeDocument(
  normalizedPath: string,
  content: string,
  expectedRevision?: string,
): Promise<LineDocument> {
  const destination = await resolveWriteDestination(normalizedPath)
  const queueKey = await resolveWriteQueueKey(destination)

  return documentSaveQueue.run(queueKey, async () => {
    let writtenRevision: string
    if (expectedRevision === undefined) {
      await atomicWriteFile(destination, content)
      writtenRevision = createDocumentRevision(content)
    } else {
      writtenRevision = await writeFileIfUnchanged(
        destination,
        content,
        expectedRevision,
      )
    }
    const savedDocument = await readDocument(normalizedPath)
    return { ...savedDocument, revision: writtenRevision }
  })
}

function safeSuggestedName(suggestedName: unknown): string {
  const baseName =
    typeof suggestedName === 'string' && suggestedName.trim()
      ? path.basename(suggestedName.trim())
      : 'Untitled.md'

  return SUPPORTED_EXTENSIONS.has(path.extname(baseName).toLowerCase())
    ? baseName
    : `${baseName}.md`
}

async function saveDocumentAs(
  input: SaveFileAsInput,
): Promise<LineDocument | null> {
  assertString(input?.content, 'content')

  const suggestedName = safeSuggestedName(input.suggestedName)
  const normalizedCurrentPath =
    typeof input.currentPath === 'string'
      ? normalizePath(input.currentPath)
      : null
  const defaultPath = normalizedCurrentPath && grantedPaths.has(normalizedCurrentPath)
    ? input.saveCopy
      ? await resolveAvailableCopyPath(normalizedCurrentPath, suggestedName)
      : normalizedCurrentPath
    : path.join(app.getPath('documents'), suggestedName)

  const result = await showSaveDialog({
    title: 'Save Document',
    buttonLabel: 'Save',
    defaultPath,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Plain text', extensions: ['txt'] },
    ],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  const normalizedPath = normalizePath(result.filePath)
  assertSupportedPath(normalizedPath)
  grantedPaths.add(normalizedPath)
  return writeDocument(normalizedPath, input.content)
}

function sendMenuCommand(command: MenuCommand): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow
  targetWindow?.webContents.send(IPC_CHANNELS.menuCommand, command)
}

function installApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CommandOrControl+N',
          click: () => sendMenuCommand('new'),
        },
        {
          label: 'Open…',
          accelerator: 'CommandOrControl+O',
          click: () => sendMenuCommand('open'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CommandOrControl+S',
          click: () => sendMenuCommand('save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => sendMenuCommand('save-as'),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(app.isPackaged
          ? []
          : ([
              { type: 'separator' },
              { role: 'reload' },
              { role: 'toggleDevTools' },
            ] satisfies MenuItemConstructorOptions[])),
      ],
    },
    {
      role: 'windowMenu',
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.createBlank, () => createBlankDocument())
  ipcMain.handle(
    IPC_CHANNELS.openFiles,
    (_event, options?: OpenFilesOptions) => openDocuments(options),
  )
  ipcMain.handle(IPC_CHANNELS.saveFile, (_event, input: SaveFileInput) =>
    saveDocument(input),
  )
  ipcMain.handle(
    IPC_CHANNELS.saveFileAs,
    (_event, input: SaveFileAsInput) => saveDocumentAs(input),
  )
  ipcMain.handle(
    IPC_CHANNELS.platformInfo,
    (): PlatformInfo => ({
      platform: process.platform,
      architecture: process.arch,
      isMac: process.platform === 'darwin',
      versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node,
      },
    }),
  )
  ipcMain.handle(IPC_CHANNELS.rendererReady, async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return []
    const targetWindow = mainWindow
    const pendingPaths = externalFileQueue.markRendererReady()
    const documents = await readExternalDocuments(pendingPaths)

    if (
      targetWindow !== mainWindow ||
      targetWindow.isDestroyed() ||
      event.sender.isDestroyed()
    ) {
      await sendExternalDocuments(pendingPaths)
      return []
    }

    return documents
  })
}

async function readExternalDocuments(
  filePaths: string[],
): Promise<LineDocument[]> {
  const documents = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await readDocument(filePath)
      } catch {
        return null
      }
    }),
  )
  const readableDocuments = documents.filter(
    (document): document is LineDocument => document !== null,
  )
  return readableDocuments
}

async function sendExternalDocuments(filePaths: string[]): Promise<void> {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed()
  ) {
    externalFileQueue.resetRenderer()
  }

  const targetWindow = mainWindow
  const readyPaths = externalFileQueue.accept(filePaths)
  if (!targetWindow || targetWindow.isDestroyed() || readyPaths.length === 0) return

  const readableDocuments = await readExternalDocuments(readyPaths)

  if (
    targetWindow !== mainWindow ||
    targetWindow.isDestroyed() ||
    targetWindow.webContents.isDestroyed()
  ) {
    await sendExternalDocuments(readyPaths)
    return
  }

  if (readableDocuments.length > 0) {
    targetWindow.webContents.send(
      IPC_CHANNELS.externalFilesOpened,
      readableDocuments,
    )
  }
}

function createWindow(): BrowserWindow {
  externalFileQueue.resetRenderer()
  const window = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#0a0a0a',
    title: 'Line',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
      externalFileQueue.resetRenderer()
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL
    const productionEntryUrl = pathToFileURL(
      path.join(__dirname, '../dist/index.html'),
    ).href
    const allowed = devServerUrl
      ? new URL(url).origin === new URL(devServerUrl).origin
      : url === productionEntryUrl || url.startsWith(`${productionEntryUrl}#`)

    if (!allowed) {
      event.preventDefault()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return window
}

app.setName('Line')

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  void sendExternalDocuments([filePath])
})

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  )
  registerIpcHandlers()
  installApplicationMenu()
  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
