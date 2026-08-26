import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  session,
  shell,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  IPC_CHANNELS,
  type LineDocument,
  type MenuCommand,
  type OpenFilesOptions,
  type OpenFilesResult,
  type PlatformInfo,
  type SaveFileAsInput,
  type SaveFileInput,
} from './types'
import { ExternalFileQueue } from './externalFileQueue'
import {
  collectExternalFilePathsFromArgv,
  formatExternalOpenError,
  settleDocumentReads,
  SUPPORTED_EXTENSIONS,
  toOpenFilesResult,
  type ExternalOpenFailure,
} from './externalFileIntake'
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
import {
  assertDocumentByteLimit,
  DOCUMENT_TOO_LARGE_MESSAGE,
  MAX_DOCUMENT_BYTES,
} from './documentSize'
import { createSavedLineDocument } from './savedDocument'
import { resolveSaveAsExpectedRevision } from './saveAsRevision'
import { resolveSaveDialogDefaultPath } from './savePath'
import {
  CLOSE_PREPARE_TIMEOUT_MS,
  resolveUnsavedCloseAction,
  UNSAVED_CLOSE_BUTTONS,
} from './unsavedClose'
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  loadWindowState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  saveWindowState,
  type WindowBounds,
  type WindowState,
} from './windowState'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const grantedPaths = new Set<string>()
const externalFileQueue = new ExternalFileQueue()
const documentSaveQueue = new KeyedTaskQueue()
const WINDOW_STATE_SAVE_DEBOUNCE_MS = 200
const WINDOW_STATE_FILE_NAME = 'window-state.json'

let mainWindow: BrowserWindow | null = null
let allowWindowClose = false
let closePreparationPending = false
let closePrepareTimeout: NodeJS.Timeout | null = null
let quitRequested = false

function clearClosePreparation(): void {
  closePreparationPending = false
  if (closePrepareTimeout) {
    clearTimeout(closePrepareTimeout)
    closePrepareTimeout = null
  }
}

function armClosePreparationTimeout(): void {
  if (closePrepareTimeout) {
    clearTimeout(closePrepareTimeout)
  }
  closePrepareTimeout = setTimeout(() => {
    closePrepareTimeout = null
    closePreparationPending = false
    quitRequested = false
  }, CLOSE_PREPARE_TIMEOUT_MS)
}

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
    throw new Error(DOCUMENT_TOO_LARGE_MESSAGE)
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

async function chooseOpenFilePaths(
  options: OpenFilesOptions = {},
): Promise<string[]> {
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

  return result.filePaths.map(normalizePath)
}

async function readOpenDocuments(filePaths: string[]): Promise<OpenFilesResult> {
  const { documents, failures } = await settleDocumentReads(
    filePaths,
    readDocument,
  )
  return toOpenFilesResult(documents, failures)
}

async function openDocuments(
  options: OpenFilesOptions = {},
): Promise<OpenFilesResult> {
  const filePaths = await chooseOpenFilePaths(options)
  if (filePaths.length === 0) {
    return { documents: [] }
  }
  return readOpenDocuments(filePaths)
}

async function saveDocument(input: SaveFileInput): Promise<LineDocument> {
  assertString(input?.path, 'path')
  assertString(input?.content, 'content')

  const normalizedPath = normalizePath(input.path)
  assertSupportedPath(normalizedPath)
  assertDocumentByteLimit(input.content)

  if (!grantedPaths.has(normalizedPath)) {
    throw new Error('Save access has not been granted for this file.')
  }

  const expectedRevision =
    typeof input.expectedRevision === 'string'
      ? input.expectedRevision
      : undefined

  return writeDocument(normalizedPath, input.content, expectedRevision)
}

async function writeDocument(
  normalizedPath: string,
  content: string,
  expectedRevision?: string,
): Promise<LineDocument> {
  assertDocumentByteLimit(content)

  const destination = await resolveWriteDestination(normalizedPath)
  const queueKey = await resolveWriteQueueKey(destination)

  return documentSaveQueue.run(queueKey, async () => {
    let writtenRevision: string
    if (expectedRevision === undefined) {
      await atomicWriteFile(destination, content, { requireAtomic: true })
      writtenRevision = createDocumentRevision(content)
    } else {
      writtenRevision = await writeFileIfUnchanged(
        destination,
        content,
        expectedRevision,
      )
    }

    grantedPaths.add(normalizedPath)

    let modifiedAt: string | null
    try {
      modifiedAt = (await stat(normalizedPath)).mtime.toISOString()
    } catch {
      modifiedAt = new Date().toISOString()
    }

    return createSavedLineDocument({
      filePath: normalizedPath,
      content,
      revision: writtenRevision,
      modifiedAt,
    })
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

async function chooseSaveFilePath(
  input: SaveFileAsInput,
): Promise<string | null> {
  if (typeof input?.content === 'string') {
    assertDocumentByteLimit(input.content)
  }

  const suggestedName = safeSuggestedName(input.suggestedName)
  const normalizedCurrentPath =
    typeof input.currentPath === 'string'
      ? normalizePath(input.currentPath)
      : null
  const defaultPath = await resolveSaveDialogDefaultPath({
    currentPath: normalizedCurrentPath,
    currentPathGranted: Boolean(
      normalizedCurrentPath && grantedPaths.has(normalizedCurrentPath),
    ),
    defaultToDocuments: Boolean(input.defaultToDocuments),
    documentsPath: app.getPath('documents'),
    saveCopy: Boolean(input.saveCopy),
    suggestedName,
  })

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
  return normalizedPath
}

async function saveDocumentAs(
  input: SaveFileAsInput,
): Promise<LineDocument | null> {
  assertString(input?.content, 'content')
  assertDocumentByteLimit(input.content)

  const normalizedCurrentPath =
    typeof input.currentPath === 'string'
      ? normalizePath(input.currentPath)
      : null
  const currentPathGranted = Boolean(
    normalizedCurrentPath && grantedPaths.has(normalizedCurrentPath),
  )

  const normalizedPath = await chooseSaveFilePath(input)
  if (!normalizedPath) {
    return null
  }

  const expectedRevision = resolveSaveAsExpectedRevision({
    chosenPath: normalizedPath,
    currentPath: normalizedCurrentPath,
    currentPathGranted,
    expectedRevision:
      typeof input.expectedRevision === 'string'
        ? input.expectedRevision
        : undefined,
  })

  return writeDocument(normalizedPath, input.content, expectedRevision)
}

async function revealInFolder(filePath: unknown): Promise<boolean> {
  assertString(filePath, 'path')

  const normalizedPath = normalizePath(filePath)
  if (!grantedPaths.has(normalizedPath)) {
    throw new Error('Access has not been granted for this file.')
  }

  const fileStats = await stat(normalizedPath)
  if (!fileStats.isFile()) {
    throw new Error('The selected item is not a file.')
  }

  shell.showItemInFolder(normalizedPath)
  return true
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
          label: 'Duplicate',
          accelerator: 'CommandOrControl+Shift+D',
          click: () => sendMenuCommand('duplicate'),
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
        {
          label: 'Show in Finder',
          accelerator: 'CommandOrControl+Shift+J',
          click: () => sendMenuCommand('reveal-in-folder'),
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
        { type: 'separator' },
        {
          label: 'Copy HTML',
          accelerator: 'CommandOrControl+Shift+C',
          click: () => sendMenuCommand('copy-html'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Editor',
          accelerator: 'CommandOrControl+1',
          click: () => sendMenuCommand('edit-mode'),
        },
        {
          label: 'Split View',
          accelerator: 'CommandOrControl+2',
          click: () => sendMenuCommand('split-mode'),
        },
        {
          label: 'Preview',
          accelerator: 'CommandOrControl+3',
          click: () => sendMenuCommand('preview-mode'),
        },
        { type: 'separator' },
        {
          label: 'Inspector',
          accelerator: 'CommandOrControl+Shift+I',
          click: () => sendMenuCommand('toggle-inspector'),
        },
        {
          label: 'Focus Mode',
          accelerator: 'CommandOrControl+Shift+F',
          click: () => sendMenuCommand('toggle-focus'),
        },
        { type: 'separator' },
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
    IPC_CHANNELS.chooseOpenFiles,
    (_event, options?: OpenFilesOptions) => chooseOpenFilePaths(options),
  )
  ipcMain.handle(
    IPC_CHANNELS.readOpenFiles,
    (_event, filePaths: string[]) => {
      if (!Array.isArray(filePaths)) {
        throw new TypeError('filePaths must be an array.')
      }
      return readOpenDocuments(filePaths.map(String))
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.openFiles,
    (_event, options?: OpenFilesOptions) => openDocuments(options),
  )
  ipcMain.handle(IPC_CHANNELS.saveFile, (_event, input: SaveFileInput) =>
    saveDocument(input),
  )
  ipcMain.handle(
    IPC_CHANNELS.chooseSaveFileAs,
    (_event, input: SaveFileAsInput) => chooseSaveFilePath(input),
  )
  ipcMain.handle(
    IPC_CHANNELS.saveFileAs,
    (_event, input: SaveFileAsInput) => saveDocumentAs(input),
  )
  ipcMain.handle(IPC_CHANNELS.revealInFolder, (_event, filePath: unknown) =>
    revealInFolder(filePath),
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
    const { documents, failures } = await readExternalDocuments(pendingPaths)

    if (
      targetWindow !== mainWindow ||
      targetWindow.isDestroyed() ||
      event.sender.isDestroyed()
    ) {
      await sendExternalDocuments(pendingPaths)
      return []
    }

    // Defer so the renderer's readyForExternalFiles().then(...) can accept
    // documents before the failure lands on the existing error banner.
    if (failures.length > 0) {
      setImmediate(() => {
        if (
          targetWindow !== mainWindow ||
          targetWindow.isDestroyed() ||
          targetWindow.webContents.isDestroyed()
        ) {
          return
        }
        notifyExternalOpenFailures(failures, targetWindow)
      })
    }
    return documents
  })
  ipcMain.on(IPC_CHANNELS.prepareCloseFinished, (event, success: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || !closePreparationPending) return

    clearClosePreparation()
    if (success !== true) {
      quitRequested = false
      return
    }

    allowWindowClose = true
    if (quitRequested) {
      app.quit()
    } else {
      mainWindow.close()
    }
  })
}

async function readExternalDocuments(
  filePaths: string[],
): Promise<{ documents: LineDocument[]; failures: ExternalOpenFailure[] }> {
  return settleDocumentReads(filePaths, readDocument)
}

function notifyExternalOpenFailures(
  failures: ExternalOpenFailure[],
  targetWindow: BrowserWindow | null = mainWindow,
): void {
  if (failures.length === 0) return
  if (
    !targetWindow ||
    targetWindow.isDestroyed() ||
    targetWindow.webContents.isDestroyed()
  ) {
    return
  }

  targetWindow.webContents.send(
    IPC_CHANNELS.externalOpenFailed,
    formatExternalOpenError(failures),
  )
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
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

  const { documents, failures } = await readExternalDocuments(readyPaths)

  if (
    targetWindow !== mainWindow ||
    targetWindow.isDestroyed() ||
    targetWindow.webContents.isDestroyed()
  ) {
    await sendExternalDocuments(readyPaths)
    return
  }

  if (documents.length > 0) {
    targetWindow.webContents.send(
      IPC_CHANNELS.externalFilesOpened,
      documents,
    )
  }

  notifyExternalOpenFailures(failures, targetWindow)
}

function windowStateFilePath(): string {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE_NAME)
}

function readWindowStateFile(filePath: string): string {
  return readFileSync(filePath, 'utf8')
}

function writeWindowStateFile(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, 'utf8')
}

function loadRestoredWindowState(): WindowState | null {
  return loadWindowState(
    windowStateFilePath(),
    (saved) => screen.getDisplayNearestPoint({ x: saved.x, y: saved.y }).workArea,
    readWindowStateFile,
  )
}

function createWindow(): BrowserWindow {
  externalFileQueue.resetRenderer()
  allowWindowClose = false
  clearClosePreparation()
  const restored = loadRestoredWindowState()
  const window = new BrowserWindow({
    width: restored?.width ?? DEFAULT_WINDOW_WIDTH,
    height: restored?.height ?? DEFAULT_WINDOW_HEIGHT,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
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

  let lastNormalBounds: WindowBounds = restored
    ? { x: restored.x, y: restored.y, width: restored.width, height: restored.height }
    : window.getBounds()
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const persistWindowState = (): void => {
    if (window.isDestroyed()) return
    const isMaximized = window.isMaximized()
    if (!isMaximized && !window.isMinimized()) {
      lastNormalBounds = window.getBounds()
    }
    try {
      saveWindowState(
        windowStateFilePath(),
        lastNormalBounds,
        isMaximized,
        writeWindowStateFile,
      )
    } catch {
      return
    }
  }

  const schedulePersistWindowState = (): void => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      persistWindowState()
    }, WINDOW_STATE_SAVE_DEBOUNCE_MS)
  }

  window.once('ready-to-show', () => {
    if (restored?.isMaximized) {
      window.maximize()
    }
    window.show()
  })
  window.on('resize', schedulePersistWindowState)
  window.on('move', schedulePersistWindowState)
  window.on('close', () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    persistWindowState()
  })
  window.webContents.on('will-prevent-unload', (event) => {
    if (allowWindowClose) {
      event.preventDefault()
      return
    }
    if (closePreparationPending) return

    // Hold the page's prevent-unload, show the sheet async, then prepare close.
    // Avoid showMessageBoxSync which blocks the whole main process.
    closePreparationPending = true
    void dialog
      .showMessageBox(window, {
        type: 'warning',
        buttons: [...UNSAVED_CLOSE_BUTTONS],
        defaultId: 0,
        cancelId: 1,
        title: 'Save changes before closing?',
        message: 'Save changes to files before closing?',
        detail:
          "If you close without saving, your changes will remain in Line's library but will not be written to their files.",
        noLink: true,
      })
      .then(({ response }) => {
        if (window.isDestroyed()) {
          clearClosePreparation()
          return
        }

        const action = resolveUnsavedCloseAction(response)
        if (action === 'cancel') {
          clearClosePreparation()
          quitRequested = false
          return
        }

        armClosePreparationTimeout()
        window.webContents.send(
          IPC_CHANNELS.prepareClose,
          action === 'save' ? 'save' : 'preserve',
        )
      })
      .catch(() => {
        clearClosePreparation()
        quitRequested = false
      })
  })
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
      clearClosePreparation()
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

function intakeArgvFiles(argv: readonly string[]): void {
  const filePaths = collectExternalFilePathsFromArgv(argv, {
    ignorePaths: new Set([normalizePath(process.execPath)]),
  })
  if (filePaths.length === 0) return
  void sendExternalDocuments(filePaths)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    focusMainWindow()
    intakeArgvFiles(argv)
  })

  app.setName('Line')
  if (process.platform === 'darwin' && !app.isPackaged) {
    process.title = 'Line'
  }

  app.on('before-quit', () => {
    quitRequested = true
  })

  // macOS Finder / Dock deliver paths here, including cold-start drops before ready.
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

    // CLI / non-Finder launches may only provide paths on argv.
    intakeArgvFiles(process.argv)

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
}
