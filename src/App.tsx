import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { extractOutline, MarkdownPreview, type OutlineItem } from './components/MarkdownPreview'
import { buildDocumentStats } from './documentStats'
import { footerFileLabel, formatReadTimeLabel, formatWordCountLabel } from './editorFooter'
import { countWords, estimateReadTime, parseMarkdownMetadata } from './lib'
import { LatestTaskQueue } from './latestTaskQueue'
import { canRevealDocument } from './canRevealDocument'
import { duplicateLineDocument } from './duplicateDocument'
import { documentIsUnlinked, type LineDocument } from './lineDocument'
import {
  cycleLibrarySort,
  librarySortLabel,
  loadLibrarySort,
  saveLibrarySort,
  sortDocuments,
  type LibrarySort,
} from './librarySort'
import { LIBRARY_PERSIST_FAILED_MESSAGE, loadPersistedDocuments, removeDocumentFromLibrary, removeLegacyDemoDocuments, restoreDocumentToLibrary, savePersistedDocuments } from './persistedLibrary'
import { libraryPaneHeading, resolveActiveFilter, resolveActiveTag, resolveSelectionAfterDocumentsChange } from './selection'
import { resolveSaveAs, saveDocumentsBeforeClose } from './saveBeforeClose'
import { previewHtmlForClipboard } from './copyPreviewHtml'
import { applyEditorIndent } from './editorIndent'
import { isMarkdownEditorTarget, shouldFocusLibrarySearchOnFind } from './findShortcut'
import { appShellClassName } from './focusMode'
import { resolveLibraryKeyboardTarget } from './libraryKeyboard'
import { markdownWrapKindFromModKey, wrapMarkdownSelection } from './markdownWrap'
import { type EditorMode, resolveMenuLayoutAction } from './menuLayout'
import { AUTOSAVE_DELAY_MS, shouldAutosave } from './autosave'
import { reconcileSaveState, resolveSaveChipLabel, resolveSaveState, type SaveState } from './saveState'
import { loadSessionChrome, saveSessionChrome, type SessionChrome } from './sessionChrome'
type SaveRequest = {
  defaultToDocuments: boolean
  document: LineDocument
  saveAs: boolean
  saveCopy: boolean
  silent?: boolean
}
type ToastState = {
  message: string
  actionLabel?: string
}
type PendingLibraryUndo = {
  document: LineDocument
  index: number
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Just now'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const lineApi = () => typeof window !== 'undefined' ? window.line : undefined

function isDocument(value: unknown): value is LineDocument {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string'
}

function isLibraryKeyboardScope(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (isMarkdownEditorTarget(target)) return false
  if (target.closest('.document-search')) return false
  return Boolean(target.closest('.document-list, .document-pane'))
}

const DOCUMENT_CONFLICT_MESSAGE =
  'This document changed on disk. Use Save As to keep your version without overwriting the external changes.'
const ATOMIC_SAVE_UNAVAILABLE_MESSAGE =
  'This document cannot be safely saved at its current location. Use Save As to keep your version.'

function readPersistedDocuments(): LineDocument[] {
  return removeLegacyDemoDocuments(loadPersistedDocuments(() => window.localStorage, []))
}

function readPersistedSessionChrome(documents: LineDocument[] = readPersistedDocuments()) {
  return loadSessionChrome(
    () => window.localStorage,
    documents.map((document) => document.id),
  )
}

function normalizeImported(value: unknown): LineDocument | null {
  if (isDocument(value)) return value
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.content !== 'string') return null
  const metadata = parseMarkdownMetadata(item.content)
  const fileName = typeof item.name === 'string' ? item.name.replace(/\.(?:md|markdown|txt)$/i, '') : ''
  const derivedTitle = metadata.title === 'Untitled' ? '' : metadata.title
  const title = typeof item.title === 'string' ? item.title : derivedTitle || fileName || 'Imported note'
  const rawUpdatedAt =
    typeof item.updatedAt === 'string' ? item.updatedAt
    : typeof item.modifiedAt === 'string' ? item.modifiedAt
    : null
  const parsedMs = rawUpdatedAt ? new Date(rawUpdatedAt).getTime() : Number.NaN
  return {
    id: typeof item.id === 'string' ? item.id : `import-${Date.now()}`,
    title,
    content: item.content,
    folder: typeof item.folder === 'string' ? item.folder : 'Documents',
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : metadata.tags,
    favorite: Boolean(item.favorite),
    updatedAt: formatDate(rawUpdatedAt),
    updatedAtMs: Number.isFinite(parsedMs) ? parsedMs : Date.now(),
    path: typeof item.path === 'string' ? item.path : null,
    revision: typeof item.revision === 'string' ? item.revision : null,
  }
}

function reconcileOpenedDocuments(current: LineDocument[], incoming: LineDocument[]) {
  let protectedCount = 0
  const documents = incoming.map((document) => {
    const existing = current.find((candidate) => candidate.id === document.id || Boolean(candidate.path && candidate.path === document.path))
    if (!existing) return document
    if (existing.dirty) {
      protectedCount += 1
      return existing
    }
    return { ...document, id: existing.id }
  })
  return { documents, protectedCount }
}

function PlainButton({ icon, label, onClick, active = false, disabled = false, className = '' }: { icon: IconName; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button aria-label={label} className={`icon-button ${active ? 'is-active' : ''} ${className}`} disabled={disabled} onClick={onClick} title={label} type="button">
      <Icon name={icon} size={18} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function TrafficLights() {
  if (lineApi()) return null
  return <div aria-hidden="true" className="traffic-lights"><i className="traffic-close" /><i className="traffic-minimize" /><i className="traffic-expand" /></div>
}

function Sidebar({ documents, activeFilter, activeTag, onFilter, onTag, onOpenFolder }: {
  documents: LineDocument[]
  activeFilter: string
  activeTag: string | null
  onFilter: (filter: string) => void
  onTag: (tag: string | null) => void
  onOpenFolder: () => void
}) {
  const favorites = documents.filter((doc) => doc.favorite)
  const tags = Array.from(new Set(documents.flatMap((doc) => doc.tags)))
  const unlinkedCount = documents.filter(documentIsUnlinked).length

  return (
    <aside className="sidebar pane">
      <header className="sidebar-header titlebar-region">
        <TrafficLights />
        <div className="sidebar-header-actions no-drag">
          <PlainButton icon="folderAdd" label="Import files" onClick={onOpenFolder} />
        </div>
      </header>

      <div className="sidebar-scroll">
        {favorites.length > 0 && (
          <section className="nav-section">
            <p className="section-label">Starred</p>
            {favorites.map((doc) => (
            <button className="nav-row starred-row" key={doc.id} onClick={() => onFilter(`doc:${doc.id}`)} type="button">
              <Icon filled name="star" size={16} />
              <span>{doc.title}</span>
            </button>
            ))}
          </section>
        )}

        <section className="nav-section">
          <p className="section-label">Documents</p>
          <button className={`nav-row ${activeFilter === 'all' && !activeTag ? 'selected' : ''}`} onClick={() => onFilter('all')} type="button">
            <span className="chevron-spacer" /><Icon name="grid" size={16} /><span>All Documents</span><small>{documents.length}</small>
          </button>
          {unlinkedCount > 0 && (
            <button className={`nav-row ${activeFilter === 'unlinked' ? 'selected' : ''}`} onClick={() => onFilter('unlinked')} type="button">
              <span className="chevron-spacer" /><Icon name="link" size={16} /><span>Unlinked</span><small>{unlinkedCount}</small>
            </button>
          )}
        </section>

        {tags.length > 0 && (
          <section className="nav-section tag-section">
            <p className="section-label">Tags</p>
            <div className="tag-cloud">
              <button className={!activeTag ? 'selected-tag' : ''} onClick={() => onTag(null)} type="button">All Tags</button>
              {tags.map((tag) => <button className={activeTag === tag ? 'selected-tag' : ''} key={tag} onClick={() => onTag(tag)} type="button">#{tag}</button>)}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

function DocumentList({ documents, selectedId, search, activeFilter, activeTag, librarySort, onSearch, onSelect, onFavorite, onRemove, onNew, onImport, onCycleSort }: {
  documents: LineDocument[]
  selectedId: string | null
  search: string
  activeFilter: string
  activeTag: string | null
  librarySort: LibrarySort
  onSearch: (value: string) => void
  onSelect: (id: string) => void
  onFavorite: (id: string) => void
  onRemove: (id: string) => void
  onNew: () => void
  onImport: () => void
  onCycleSort: () => void
}) {
  const isFiltered = Boolean(search || activeTag || activeFilter === 'unlinked')

  return (
    <section className="document-pane pane">
      <header className="document-toolbar titlebar-region">
        <div className="document-heading">{libraryPaneHeading(activeFilter, activeTag)}</div>
        <div className="toolbar-group no-drag">
          <PlainButton icon="sort" label={librarySortLabel(librarySort)} onClick={onCycleSort} />
          <PlainButton icon="newDocument" label="New document" onClick={onNew} />
          <PlainButton icon="import" label="Import Markdown" onClick={onImport} />
        </div>
      </header>

      <div className="document-search">
        <Icon name="search" size={15} />
        <input aria-label="Search documents" onChange={(event) => onSearch(event.target.value)} placeholder="Search documents" value={search} />
        {search && <button aria-label="Clear search" onClick={() => onSearch('')} type="button"><Icon name="close" size={13} /></button>}
      </div>

      <div className="document-list">
        {documents.length ? documents.map((doc) => (
          <div
            className={`document-card ${selectedId === doc.id ? 'selected' : ''}`}
            key={doc.id}
          >
            <button className="document-card-main" onClick={() => onSelect(doc.id)} type="button">
              <span className="document-card-top">
                <strong>{doc.title || 'Untitled'}</strong>
                {doc.dirty && <i className="dirty-dot" title="Unsaved changes" />}
              </span>
              <span className="document-excerpt">{doc.content.replace(/[#>*`\n-]/g, ' ').replace(/\s+/g, ' ').trim()}</span>
              <span className="document-meta"><time>{doc.updatedAt}</time>{doc.tags.map((tag) => <small key={tag}>#{tag}</small>)}</span>
            </button>
            <button
              aria-label="Remove from library"
              className="remove-control"
              onClick={() => onRemove(doc.id)}
              type="button"
            >
              <Icon name="trash" size={14} />
            </button>
            <button
              aria-label={doc.favorite ? 'Remove from starred' : 'Add to starred'}
              className={`favorite-control ${doc.favorite ? 'is-favorite' : ''}`}
              onClick={() => onFavorite(doc.id)}
              type="button"
            >
                <Icon filled={doc.favorite} name="star" size={14} />
            </button>
          </div>
        )) : (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="document" size={22} /></span>
            <strong>{isFiltered ? 'No matching files' : 'No Markdown files yet'}</strong>
            <p>{isFiltered ? 'Try another search.' : 'Create a blank file or open Markdown from your Mac.'}</p>
            {!isFiltered && <div className="empty-actions"><button onClick={onNew} type="button">Create file</button><button onClick={onImport} type="button">Open file</button></div>}
          </div>
        )}
      </div>
    </section>
  )
}

function handleMarkdownWrapKeyDown(
  event: { altKey: boolean; currentTarget: HTMLTextAreaElement; key: string; metaKey: boolean; preventDefault: () => void; shiftKey: boolean; target: EventTarget },
  onDocumentChange: (change: Partial<LineDocument>) => void,
) {
  if (!isMarkdownEditorTarget(event.target)) return
  const kind = markdownWrapKindFromModKey(event)
  if (!kind) return

  event.preventDefault()
  const textarea = event.currentTarget
  const next = wrapMarkdownSelection({
    value: textarea.value,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    kind,
  })
  onDocumentChange({ content: next.value })
  window.setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(next.selectionStart, next.selectionEnd)
  }, 0)
}

function ModeControl({ mode, onMode, disabled = false }: { mode: EditorMode; onMode: (mode: EditorMode) => void; disabled?: boolean }) {
  const modes: { mode: EditorMode; icon: IconName; label: string }[] = [
    { mode: 'edit', icon: 'edit', label: 'Editor' },
    { mode: 'split', icon: 'split', label: 'Split view' },
    { mode: 'preview', icon: 'eye', label: 'Preview' },
  ]
  return <div className="segmented mode-control">{modes.map((item) => <PlainButton active={mode === item.mode} disabled={disabled} icon={item.icon} key={item.mode} label={item.label} onClick={() => onMode(item.mode)} />)}</div>
}

function Workspace({ document, mode, saveState, textareaRef, onDocumentChange, onMode, onSave, onNew, onOpen, inspectorOpen, onInspector, focusMode, onFocusMode }: {
  document: LineDocument | null
  mode: EditorMode
  saveState: SaveState
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onDocumentChange: (change: Partial<LineDocument>) => void
  onMode: (mode: EditorMode) => void
  onSave: () => void
  onNew: () => void
  onOpen: () => void
  inspectorOpen: boolean
  onInspector: () => void
  focusMode: boolean
  onFocusMode: () => void
}) {
  const wordCount = document ? countWords(document.content) : 0
  const fileLabel = footerFileLabel(document?.path)
  return (
    <main className="workspace pane">
      <header className="workspace-toolbar titlebar-region">
        <div className="workspace-title-wrap no-drag">
          <Icon name="document" size={15} />
          <span>{document?.title || 'No document selected'}</span>
        </div>
        <div className="workspace-center no-drag"><ModeControl disabled={!document} mode={mode} onMode={onMode} /></div>
        <div className="workspace-actions no-drag">
          <button className={`save-status ${saveState}`} onClick={onSave} type="button">
            <Icon name="save" size={16} />
            <span>{resolveSaveChipLabel(document, saveState)}</span>
          </button>
          <PlainButton active={focusMode} icon="panel" label="Focus mode" onClick={onFocusMode} />
          <PlainButton active={inspectorOpen} icon="inspector" label="Toggle inspector" onClick={onInspector} />
        </div>
      </header>

      {document ? (
        <div className={`editor-shell mode-${mode}`}>
          {mode !== 'preview' && (
            <div className="source-column">
              <textarea
                aria-label="Markdown editor"
                className="markdown-source"
                onChange={(event) => onDocumentChange({ content: event.target.value })}
                onKeyDown={(event) => {
                  handleMarkdownWrapKeyDown(event, onDocumentChange)
                  if (event.metaKey || event.ctrlKey || event.altKey) return
                  const textarea = event.currentTarget
                  const result = applyEditorIndent(
                    {
                      value: textarea.value,
                      selectionStart: textarea.selectionStart,
                      selectionEnd: textarea.selectionEnd,
                    },
                    event.key,
                    event.shiftKey,
                  )
                  if (!result) return
                  event.preventDefault()
                  if (result.value !== textarea.value) {
                    onDocumentChange({ content: result.value })
                  }
                  const { selectionStart, selectionEnd } = result
                  window.requestAnimationFrame(() => {
                    textarea.setSelectionRange(selectionStart, selectionEnd)
                  })
                }}
                placeholder={'# Your title\n\nStart writing in Markdown…'}
                ref={textareaRef}
                spellCheck
                value={document.content}
              />
            </div>
          )}
          {mode !== 'edit' && <div className="preview-column" data-preview-scroll><MarkdownPreview markdown={document.content} /></div>}
          <footer className="editor-footer">
            <span>{formatWordCountLabel(wordCount)}</span>
            {wordCount > 0 ? <span>{formatReadTimeLabel(estimateReadTime(wordCount))}</span> : null}
            {fileLabel ? <span title={document.path ?? undefined}>{fileLabel}</span> : null}
            <span>{document.dirty ? 'Edited' : 'Markdown'}</span>
          </footer>
        </div>
      ) : (
        <div className="workspace-empty">
          <span><Icon name="edit" size={28} /></span>
          <p className="workspace-kicker">LINE FOR MARKDOWN</p>
          <h2>Write something worth keeping.</h2>
          <p>Create a clean Markdown file or open one already on your Mac.</p>
          <div className="workspace-empty-actions">
            <button className="primary" onClick={onNew} type="button"><Icon name="newDocument" size={16} />Create Markdown</button>
            <button onClick={onOpen} type="button"><Icon name="import" size={16} />Open file</button>
          </div>
          <small>Markdown, plain text, and nothing in the way.</small>
        </div>
      )}
    </main>
  )
}

type InspectorTab = 'outline' | 'stats'

function Inspector({ document, outline, activeId, search, onSearch, onNavigate, onClose }: {
  document: LineDocument | null
  outline: OutlineItem[]
  activeId: string | null
  search: string
  onSearch: (value: string) => void
  onNavigate: (item: OutlineItem) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<InspectorTab>('outline')
  const outlineTabRef = useRef<HTMLButtonElement>(null)
  const statsTabRef = useRef<HTMLButtonElement>(null)
  const visibleOutline = outline.filter((item) => item.text.toLowerCase().includes(search.toLowerCase()))
  const stats = useMemo(() => buildDocumentStats({
    content: document?.content ?? '',
    path: document?.path ?? null,
    tags: document?.tags ?? [],
    dirty: document?.dirty,
  }), [document])

  const selectTab = (next: InspectorTab) => {
    setTab(next)
    const target = next === 'outline' ? outlineTabRef.current : statsTabRef.current
    target?.focus()
  }

  return (
    <aside className="inspector pane">
      <header className="inspector-toolbar titlebar-region">
        <label className="inspector-search no-drag"><Icon name="search" size={16} /><input aria-label="Search outline" onChange={(event) => onSearch(event.target.value)} placeholder="Search" value={search} /></label>
      </header>
      <div className="inspector-body">
        <div className="inspector-document-title"><strong>{document?.title || 'No document'}</strong><PlainButton icon="close" label="Close inspector" onClick={onClose} /></div>
        <div
          aria-label="Inspector"
          className="inspector-tabs"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault()
              selectTab(tab === 'outline' ? 'stats' : 'outline')
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault()
              selectTab(tab === 'outline' ? 'stats' : 'outline')
            } else if (event.key === 'Home') {
              event.preventDefault()
              selectTab('outline')
            } else if (event.key === 'End') {
              event.preventDefault()
              selectTab('stats')
            }
          }}
          role="tablist"
        >
          <button
            aria-controls="inspector-panel-outline"
            aria-label="Outline"
            aria-selected={tab === 'outline'}
            className={tab === 'outline' ? 'active' : ''}
            id="inspector-tab-outline"
            onClick={() => setTab('outline')}
            ref={outlineTabRef}
            role="tab"
            tabIndex={tab === 'outline' ? 0 : -1}
            type="button"
          >
            <Icon name="list" size={16} />
          </button>
          <button
            aria-controls="inspector-panel-stats"
            aria-label="Stats"
            aria-selected={tab === 'stats'}
            className={tab === 'stats' ? 'active' : ''}
            id="inspector-tab-stats"
            onClick={() => setTab('stats')}
            ref={statsTabRef}
            role="tab"
            tabIndex={tab === 'stats' ? 0 : -1}
            type="button"
          >
            <Icon name="document" size={16} />
          </button>
        </div>
        {tab === 'outline' ? (
          <div aria-labelledby="inspector-tab-outline" id="inspector-panel-outline" role="tabpanel">
            <div className="outline-heading"><span>Contents</span><small>{outline.length}</small></div>
            <nav className="outline-list">
              {visibleOutline.length ? visibleOutline.map((item) => (
                <button
                  className={`${activeId === item.id ? 'active' : ''} level-${item.level}`}
                  key={`${item.id}-${item.line}`}
                  onClick={() => onNavigate(item)}
                  title={item.text}
                  type="button"
                >
                  {item.text}
                </button>
              )) : <div className="outline-empty">{outline.length ? 'No matching sections' : 'Add headings to build an outline'}</div>}
            </nav>
          </div>
        ) : (
          <div aria-labelledby="inspector-tab-stats" id="inspector-panel-stats" role="tabpanel" tabIndex={0}>
            <dl className="inspector-stats">
              <div><dt>Words</dt><dd>{stats.words.toLocaleString()}</dd></div>
              <div><dt>Characters</dt><dd>{stats.characters.toLocaleString()}</dd></div>
              <div><dt>Reading time</dt><dd>{stats.readTimeMinutes} min</dd></div>
              <div><dt>Headings</dt><dd>{stats.headingCount.toLocaleString()}</dd></div>
              <div><dt>Tags</dt><dd>{stats.tagCount.toLocaleString()}</dd></div>
              <div><dt>File</dt><dd title={document?.path || stats.pathLabel}>{stats.pathLabel}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </aside>
  )
}

export default function App() {
  const [documents, setDocuments] = useState<LineDocument[]>(readPersistedDocuments)
  const [selectedId, setSelectedId] = useState<string | null>(() => readPersistedSessionChrome().selectedId)
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [librarySort, setLibrarySort] = useState<LibrarySort>(() => loadLibrarySort(() => window.localStorage))
  const [outlineSearch, setOutlineSearch] = useState('')
  const [mode, setMode] = useState<EditorMode>(() => readPersistedSessionChrome().mode)
  const [inspectorOpen, setInspectorOpen] = useState(() => readPersistedSessionChrome().inspectorOpen)
  const [focusMode, setFocusMode] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>(() => {
    const initialDocuments = readPersistedDocuments()
    const selected = initialDocuments.find((document) => document.id === readPersistedSessionChrome(initialDocuments).selectedId)
    return resolveSaveState(selected)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toastTimer = useRef<number | null>(null)
  const pendingLibraryUndoRef = useRef<PendingLibraryUndo | null>(null)
  const saveQueueRef = useRef(new LatestTaskQueue<SaveRequest>())
  const closeReadyRef = useRef(false)
  const externalFilesReadyRef = useRef(false)
  const documentsRef = useRef(documents)
  const selectedIdRef = useRef(selectedId)
  const visibleIdsRef = useRef<readonly string[]>([])

  documentsRef.current = documents
  selectedIdRef.current = selectedId

  const selectedDocument = documents.find((document) => document.id === selectedId) || null
  const outline = useMemo(() => extractOutline(selectedDocument?.content || ''), [selectedDocument?.content])

  const showToast = useCallback((message: string, options?: { actionLabel?: string; undo?: PendingLibraryUndo }) => {
    pendingLibraryUndoRef.current = options?.undo ?? null
    setToast({ message, actionLabel: options?.actionLabel })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      pendingLibraryUndoRef.current = null
      setToast(null)
    }, 2600)
  }, [])

  const copyPreviewHtml = useCallback(async () => {
    const content = documentsRef.current.find((document) => document.id === selectedIdRef.current)?.content ?? ''
    const html = previewHtmlForClipboard(content)
    if (typeof navigator.clipboard?.writeText !== 'function') {
      setError('Could not copy HTML.')
      return
    }
    try {
      await navigator.clipboard.writeText(html)
      showToast('HTML copied')
    } catch {
      setError('Could not copy HTML.')
    }
  }, [showToast])

  const acceptExternalDocuments = useCallback((externalDocuments: unknown[]) => {
    if (closeReadyRef.current) return
    const opened = externalDocuments.map(normalizeImported).filter((document): document is LineDocument => document !== null)
    if (!opened.length) return
    const { documents: safeOpened, protectedCount } = reconcileOpenedDocuments(documentsRef.current, opened)
    const openedIds = new Set(safeOpened.map((document) => document.id))
    const nextDocuments = [...safeOpened, ...documentsRef.current.filter((document) => !openedIds.has(document.id))]
    documentsRef.current = nextDocuments
    setDocuments(nextDocuments)
    setSelectedId(safeOpened[0].id)
    setError(null)
    setSaveState(resolveSaveState(safeOpened[0]))
    setActiveOutlineId(null)
    setActiveFilter('all')
    setActiveTag(null)
    setSearch('')
    if (protectedCount > 0) {
      showToast('Kept your unsaved version of an open document')
    }
  }, [showToast])

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = documents.filter((document) => {
      if (activeFilter === 'unlinked' && !documentIsUnlinked(document)) return false
      if (activeFilter.startsWith('doc:') && document.id !== activeFilter.slice(4)) return false
      if (activeTag && !document.tags.includes(activeTag)) return false
      if (!query) return true
      return `${document.title} ${document.content} ${document.tags.join(' ')}`.toLowerCase().includes(query)
    })
    return sortDocuments(filtered, librarySort)
  }, [documents, activeFilter, activeTag, search, librarySort])

  visibleIdsRef.current = filteredDocuments.map((document) => document.id)

  // Tags are live-derived from documents. Clear a ghost filter when the tag
  // disappears from every note (sidebar tags section may unmount entirely).
  useEffect(() => {
    const availableTags = Array.from(new Set(documents.flatMap((document) => document.tags)))
    const nextTag = resolveActiveTag(activeTag, availableTags)
    if (nextTag !== activeTag) setActiveTag(nextTag)
  }, [documents, activeTag])

  // Unlinked row hides at zero. Clear the filter so the empty state does not stick.
  useEffect(() => {
    const hasUnlinked = documents.some(documentIsUnlinked)
    const nextFilter = resolveActiveFilter(activeFilter, hasUnlinked)
    if (nextFilter !== activeFilter) setActiveFilter(nextFilter)
  }, [documents, activeFilter])

  const synchronizeSelection = useCallback((nextSelectedId: string | null) => {
    const nextDocument = documentsRef.current.find((document) => document.id === nextSelectedId)
    const selectionChanged = nextSelectedId !== selectedIdRef.current
    // Same selection still needs dirty→saveState (cold start: selectedId already matches).
    if (!selectionChanged) {
      setSaveState((current) => reconcileSaveState(current, nextDocument, false))
      return
    }

    selectedIdRef.current = nextSelectedId
    setSelectedId(nextSelectedId)
    setError(null)
    setSaveState(reconcileSaveState('idle', nextDocument, true))
    setActiveOutlineId(null)
  }, [])

  const restoreLastLibraryRemove = useCallback(() => {
    const pending = pendingLibraryUndoRef.current
    if (!pending || closeReadyRef.current) return

    pendingLibraryUndoRef.current = null
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(null)

    const nextDocuments = restoreDocumentToLibrary(documentsRef.current, pending.document, pending.index)
    documentsRef.current = nextDocuments
    setDocuments(nextDocuments)
    synchronizeSelection(pending.document.id)
  }, [synchronizeSelection])

  const updateDocument = useCallback((change: Partial<LineDocument>) => {
    if (!selectedId || closeReadyRef.current) return
    const metadata = typeof change.content === 'string' ? parseMarkdownMetadata(change.content) : null
    const nextDocuments = documentsRef.current.map((document) => document.id === selectedId ? {
      ...document,
      ...change,
      ...(metadata ? { title: metadata.title, tags: metadata.tags } : {}),
      dirty: true,
      updatedAt: 'Just now',
      updatedAtMs: Date.now(),
    } : document)
    documentsRef.current = nextDocuments
    setDocuments(nextDocuments)
    setSaveState('dirty')
  }, [selectedId])

  const duplicateDocument = useCallback(() => {
    if (closeReadyRef.current) return
    const current = documentsRef.current.find((document) => document.id === selectedIdRef.current)
    if (!current) return

    const copy = duplicateLineDocument(current, crypto.randomUUID?.() ?? `note-${Date.now()}`)
    const nextDocuments = [copy, ...documentsRef.current]
    documentsRef.current = nextDocuments
    setDocuments(nextDocuments)
    selectedIdRef.current = copy.id
    setSelectedId(copy.id)
    setMode('edit')
    setError(null)
    setActiveFilter('all')
    setActiveTag(null)
    setSearch('')
    setSaveState('dirty')
    window.setTimeout(() => textareaRef.current?.focus(), 0)
    showToast('Document duplicated')
  }, [showToast])

  const createDocument = useCallback(async () => {
    if (closeReadyRef.current) return
    const draft: LineDocument = {
      id: `note-${Date.now()}`,
      title: 'Untitled',
      content: '',
      folder: 'Documents',
      tags: [],
      favorite: false,
      updatedAt: 'Just now',
      updatedAtMs: Date.now(),
      path: null,
      revision: null,
      dirty: true,
    }
    try {
      const result = await lineApi()?.createBlankDocument?.()
      const shellDocument = normalizeImported(result)
      const created = shellDocument ? { ...draft, id: shellDocument.id, path: shellDocument.path } : draft
      const nextDocuments = [created, ...documentsRef.current]
      documentsRef.current = nextDocuments
      setDocuments(nextDocuments)
      selectedIdRef.current = created.id
      setSelectedId(created.id)
      setMode('edit')
      setError(null)
      setActiveFilter('all')
      setActiveTag(null)
      setSearch('')
      setSaveState(resolveSaveState(created))
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the document.')
    }
  }, [])

  const importDocument = useCallback(async () => {
    if (closeReadyRef.current) return
    const api = lineApi()
    if (!api?.chooseOpenFiles && !api?.openFiles && !api?.importMarkdown) {
      showToast('Import is available in the desktop app')
      return
    }

    try {
      let imported: LineDocument[] = []
      let openError: string | undefined

      if (api.chooseOpenFiles && api.readOpenFiles) {
        const filePaths = await api.chooseOpenFiles({ multiple: true })
        // Cancel: empty paths, no spinner, no error.
        if (!filePaths.length) return

        setLoading(true)
        try {
          const result = await api.readOpenFiles(filePaths)
          imported = result.documents
            .map(normalizeImported)
            .filter((document): document is LineDocument => document !== null)
          openError = result.error
        } finally {
          setLoading(false)
        }
      } else if (api.openFiles) {
        setLoading(true)
        try {
          const result = await api.openFiles({ multiple: true })
          imported = result.documents
            .map(normalizeImported)
            .filter((document): document is LineDocument => document !== null)
          openError = result.error
        } finally {
          setLoading(false)
        }
      } else {
        const single = await api.importMarkdown?.()
        imported = [single]
          .map(normalizeImported)
          .filter((document): document is LineDocument => document !== null)
      }

      if (openError) {
        setError(openError)
      } else if (imported.length) {
        setError(null)
      }

      if (!imported.length) return

      const { documents: safeImported, protectedCount } = reconcileOpenedDocuments(documentsRef.current, imported)
      const importedIds = new Set(safeImported.map((document) => document.id))
      const nextDocuments = [...safeImported, ...documentsRef.current.filter((document) => !importedIds.has(document.id))]
      documentsRef.current = nextDocuments
      setDocuments(nextDocuments)
      setSelectedId(safeImported[0].id)
      setActiveFilter('all')
      setActiveTag(null)
      setSearch('')
      if (protectedCount > 0) {
        showToast('Kept your unsaved version of an open document')
      } else {
        showToast(safeImported.length === 1 ? 'Markdown imported' : `${safeImported.length} documents imported`)
      }
    } catch (reason) {
      setLoading(false)
      setError(reason instanceof Error ? reason.message : 'Could not import that file.')
    }
  }, [showToast])

  const performSave = useCallback(async ({
      defaultToDocuments: requestedDocumentsDefault,
      document: documentToSave,
      saveAs: requestedSaveAs,
      saveCopy: requestedSaveCopy,
      silent: requestedSilent,
    }: SaveRequest) => {
      const submittedContent = documentToSave.content

      try {
        const api = lineApi()
        const safeTitle = documentToSave.title.replace(/[/:]/g, '-').trim() || 'Untitled'
        const saveInput = {
          content: documentToSave.content,
          path: documentToSave.path,
          currentPath: documentToSave.path,
          defaultToDocuments: requestedDocumentsDefault,
          expectedRevision: documentToSave.revision,
          saveCopy: requestedSaveCopy,
          suggestedName: `${safeTitle}${requestedSaveCopy ? ' (Line copy)' : ''}.md`,
        }

        let result: unknown
        if (requestedSaveAs) {
          // Sheet first; only show Saving after the user confirms a path.
          const chosenPath = api?.chooseSaveFileAs
            ? await api.chooseSaveFileAs(saveInput)
            : null
          if (api?.chooseSaveFileAs) {
            if (chosenPath === null) {
              return { continueWithPending: false }
            }
            if (selectedIdRef.current === documentToSave.id) setSaveState('saving')
            const sameGrantedPath =
              typeof documentToSave.path === 'string' &&
              chosenPath === documentToSave.path
            result = await api.saveFile?.({
              path: chosenPath,
              content: documentToSave.content,
              expectedRevision: sameGrantedPath
                ? documentToSave.revision ?? undefined
                : undefined,
            })
          } else {
            if (selectedIdRef.current === documentToSave.id) setSaveState('saving')
            result = await api?.saveFileAs?.(saveInput)
            if (api && result === null) {
              if (selectedIdRef.current === documentToSave.id) {
                setSaveState(resolveSaveState(documentToSave))
              }
              return { continueWithPending: false }
            }
          }
        } else {
          if (selectedIdRef.current === documentToSave.id) setSaveState('saving')
          result = await api?.saveDocument?.(saveInput)
          if (api && result === null) {
            if (selectedIdRef.current === documentToSave.id) {
              setSaveState(resolveSaveState(documentToSave))
            }
            return { continueWithPending: false }
          }
        }

        const saved = normalizeImported(result)
        const latestDocument = documentsRef.current.find((document) => document.id === documentToSave.id)
        const hasNewerChanges = latestDocument?.content !== submittedContent
        const nextDocuments = documentsRef.current.map((document) => document.id === documentToSave.id ? {
          ...document,
          path: saved?.path ?? document.path,
          revision: saved?.revision ?? document.revision,
          updatedAt: saved?.updatedAt ?? document.updatedAt,
          dirty: hasNewerChanges ? document.dirty : false,
        } : document)
        documentsRef.current = nextDocuments
        setDocuments(nextDocuments)
        if (selectedIdRef.current === documentToSave.id) {
          setSaveState(hasNewerChanges ? 'dirty' : 'saved')
        }
        if (!requestedSilent) {
          showToast(hasNewerChanges ? 'Saved earlier edits; newer changes remain' : api ? 'Saved to disk' : 'Changes saved for this session')
        }
        return {
          continueWithPending: true,
          updatePending: (pending: SaveRequest): SaveRequest => saved ? {
            ...pending,
            document: {
              ...pending.document,
              path: saved.path,
              revision: saved.revision,
            },
          } : pending,
        }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : ''
        const recoveryMessage = message.includes('changed on disk')
          ? DOCUMENT_CONFLICT_MESSAGE
          : message.includes('cannot be safely saved')
            ? ATOMIC_SAVE_UNAVAILABLE_MESSAGE
            : null
        if (selectedIdRef.current !== documentToSave.id) {
          selectedIdRef.current = documentToSave.id
          setSelectedId(documentToSave.id)
          setActiveFilter('all')
          setActiveTag(null)
          setSearch('')
        }
        setSaveState(recoveryMessage ? 'dirty' : 'error')
        setError(recoveryMessage || message || 'The document could not be saved.')
        return { continueWithPending: false }
      }
  }, [showToast])

  const saveDocumentRequest = useCallback(async (request: SaveRequest) => {
    await saveQueueRef.current.run(request.document.id, request, performSave)
    await saveQueueRef.current.waitForIdle(request.document.id)
    return documentsRef.current.find((document) => document.id === request.document.id)?.dirty !== true
  }, [performSave])

  const saveDocument = useCallback(async (saveAs = false, saveCopy = false, defaultToDocuments = false, options?: { silent?: boolean }) => {
    if (!selectedDocument) return false
    return saveDocumentRequest({
      defaultToDocuments,
      document: selectedDocument,
      saveAs: resolveSaveAs(selectedDocument.path, saveAs),
      saveCopy,
      silent: options?.silent,
    })
  }, [saveDocumentRequest, selectedDocument])

  const revealSelectedDocument = useCallback(async () => {
    if (closeReadyRef.current) return
    const path = documentsRef.current.find((document) => document.id === selectedIdRef.current)?.path
    if (!canRevealDocument(path)) {
      showToast('Save this document to reveal it in Finder')
      return
    }
    try {
      await lineApi()?.revealInFolder?.(path)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reveal this document in Finder.')
    }
  }, [showToast])

  const openFolder = importDocument

  const navigateOutline = useCallback((item: OutlineItem) => {
    setActiveOutlineId(item.id)
    if (mode !== 'edit') {
      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const source = selectedDocument?.content || ''
    const start = source.split('\n').slice(0, item.line).join('\n').length + (item.line ? 1 : 0)
    const textarea = textareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(start, start)
    if (textarea) {
      const styles = window.getComputedStyle(textarea)
      const fontSize = Number.parseFloat(styles.fontSize) || 15.5
      const measured = Number.parseFloat(styles.lineHeight)
      const lineHeight = Number.isFinite(measured) ? measured : fontSize * 1.72
      textarea.scrollTop = Math.max(0, item.line * lineHeight - 80)
    }
  }, [mode, selectedDocument?.content])

  const persistDocuments = useCallback((snapshot: readonly LineDocument[]) => {
    return savePersistedDocuments(() => window.localStorage, snapshot)
  }, [])

  const persistSessionChrome = useCallback((chrome: SessionChrome) => {
    return saveSessionChrome(() => window.localStorage, chrome)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!persistDocuments(documents)) {
        setError(LIBRARY_PERSIST_FAILED_MESSAGE)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [documents, persistDocuments])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      persistSessionChrome({ selectedId, mode, inspectorOpen })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [selectedId, mode, inspectorOpen, persistSessionChrome])

  useEffect(() => {
    const conflictBlocked =
      error === DOCUMENT_CONFLICT_MESSAGE || error === ATOMIC_SAVE_UNAVAILABLE_MESSAGE
    if (
      conflictBlocked ||
      !shouldAutosave({
        dirty: selectedDocument?.dirty,
        path: selectedDocument?.path,
        saveState,
      })
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveDocument(false, false, false, { silent: true })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [documents, error, saveDocument, saveState, selectedDocument])

  useEffect(() => {
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      const latestDocuments = documentsRef.current
      if (!persistDocuments(latestDocuments)) {
        setError(LIBRARY_PERSIST_FAILED_MESSAGE)
      }
      if (!latestDocuments.some((document) => document.dirty)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnAboutUnsavedChanges)
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges)
  }, [persistDocuments])

  useEffect(() => {
    const api = lineApi()
    return api?.onPrepareClose?.((action) => {
      const markReadyToClose = () => {
        closeReadyRef.current = true
        document.body.inert = true
      }

      if (action === 'preserve') {
        const preserved = persistDocuments(documentsRef.current)
        if (!preserved) {
          setError(LIBRARY_PERSIST_FAILED_MESSAGE)
        } else {
          markReadyToClose()
        }
        api.finishPrepareClose(preserved)
        return
      }

      const dirtyDocumentIds = documentsRef.current
        .filter((document) => document.dirty)
        .map((document) => document.id)

      void saveDocumentsBeforeClose(dirtyDocumentIds, async (documentId) => {
        const documentToSave = documentsRef.current.find((document) => document.id === documentId)
        if (!documentToSave?.dirty) return true
        return saveDocumentRequest({
          defaultToDocuments: false,
          document: documentToSave,
          saveAs: resolveSaveAs(documentToSave.path),
          saveCopy: false,
        })
      }, () => {
        const latestDocuments = documentsRef.current
        if (latestDocuments.some((document) => document.dirty)) return false

        const persisted = persistDocuments(latestDocuments)
        if (!persisted) {
          setError('Documents were saved, but Line could not update its library. Try closing again.')
        } else {
          markReadyToClose()
        }
        return persisted
      }).then(api.finishPrepareClose)
        .catch(() => api.finishPrepareClose(false))
    })
  }, [persistDocuments, saveDocumentRequest])

  useEffect(() => {
    const handleAction = (action: string) => {
      if (action === 'new') void createDocument()
      if (action === 'duplicate') duplicateDocument()
      if (action === 'open' || action === 'import') void importDocument()
      if (action === 'save') void saveDocument()
      if (action === 'save-as') void saveDocument(true)
      if (action === 'reveal-in-folder') void revealSelectedDocument()
      if (action === 'copy-html') void copyPreviewHtml()
      if (action === 'toggle-inspector') setInspectorOpen((current) => !current)
      if (action === 'toggle-focus') setFocusMode((current) => !current)
      const nextMode = resolveMenuLayoutAction(action)
      if (nextMode) setMode(nextMode)
    }
    const api = lineApi()
    const disposeMenu = api?.onMenuCommand?.(handleAction) ?? api?.onShortcut?.(handleAction)
    const disposeExternal = api?.onExternalFilesOpened?.(acceptExternalDocuments)
    const disposeExternalFailed = api?.onExternalOpenFailed?.((message) => {
      if (closeReadyRef.current) return
      setError(message)
    })
    if (api?.readyForExternalFiles && !externalFilesReadyRef.current) {
      externalFilesReadyRef.current = true
      void api.readyForExternalFiles()
        .then(acceptExternalDocuments)
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not open files from Finder.'))
    }
    return () => {
      if (typeof disposeMenu === 'function') disposeMenu()
      if (typeof disposeExternal === 'function') disposeExternal()
      if (typeof disposeExternalFailed === 'function') disposeExternalFailed()
    }
  }, [acceptExternalDocuments, copyPreviewHtml, createDocument, duplicateDocument, importDocument, revealSelectedDocument, saveDocument])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); void createDocument() }
      if (event.key.toLowerCase() === 'd' && event.shiftKey) { event.preventDefault(); duplicateDocument() }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void importDocument() }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void saveDocument(event.shiftKey) }
      if (event.key.toLowerCase() === 'j' && event.shiftKey) { event.preventDefault(); void revealSelectedDocument() }
      if (event.key.toLowerCase() === 'c' && event.shiftKey) { event.preventDefault(); void copyPreviewHtml() }
      if (event.key.toLowerCase() === 'f' && !event.shiftKey) {
        if (!shouldFocusLibrarySearchOnFind(event.target, document.activeElement)) return
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.document-search input')
        input?.focus()
      }
      if (event.key.toLowerCase() === 'f' && event.shiftKey) {
        event.preventDefault()
        setFocusMode((current) => !current)
      }
      if (event.key.toLowerCase() === 'i' && event.shiftKey) { event.preventDefault(); setInspectorOpen((current) => !current) }
      if (!selectedIdRef.current) return
      if (event.key === '1') { event.preventDefault(); setMode('edit') }
      if (event.key === '2') { event.preventDefault(); setMode('split') }
      if (event.key === '3') { event.preventDefault(); setMode('preview') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copyPreviewHtml, createDocument, duplicateDocument, importDocument, revealSelectedDocument, saveDocument])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!isLibraryKeyboardScope(event.target) && !isLibraryKeyboardScope(document.activeElement)) return

      const nextId = resolveLibraryKeyboardTarget({
        key: event.key,
        selectedId: selectedIdRef.current,
        visibleIds: visibleIdsRef.current,
      })
      if (!nextId) return

      event.preventDefault()
      synchronizeSelection(nextId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [synchronizeSelection])

  useEffect(() => {
    if (!selectedId) return
    document.querySelector('.document-list .document-card.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  // Search/tag/filter only narrow the library list. Keep the open document unless
  // the user picks another one, or documents themselves change (add/remove).
  useEffect(() => {
    const nextSelectedId = resolveSelectionAfterDocumentsChange(
      selectedIdRef.current,
      documents.map((document) => document.id),
      filteredDocuments.map((document) => document.id),
    )
    synchronizeSelection(nextSelectedId)
  }, [documents, synchronizeSelection])

  return (
    <div className={appShellClassName({ inspectorOpen, focusMode })}>
      <Sidebar
        activeFilter={activeFilter}
        activeTag={activeTag}
        documents={documents}
        onFilter={(filter) => {
          if (filter.startsWith('doc:')) {
            synchronizeSelection(filter.slice(4))
            setActiveFilter('all')
            setActiveTag(null)
            setSearch('')
          } else {
            setActiveFilter(filter)
            if (filter === 'all') setActiveTag(null)
          }
        }}
        onOpenFolder={openFolder}
        onTag={setActiveTag}
      />
      <DocumentList
        activeFilter={activeFilter}
        activeTag={activeTag}
        documents={filteredDocuments}
        librarySort={librarySort}
        onCycleSort={() => {
          const nextSort = cycleLibrarySort(librarySort)
          setLibrarySort(nextSort)
          saveLibrarySort(() => window.localStorage, nextSort)
        }}
        onFavorite={(id) => {
          if (closeReadyRef.current) return
          const nextDocuments = documentsRef.current.map((document) => document.id === id ? { ...document, favorite: !document.favorite } : document)
          documentsRef.current = nextDocuments
          setDocuments(nextDocuments)
        }}
        onImport={importDocument}
        onNew={createDocument}
        onRemove={(id) => {
          if (closeReadyRef.current) return
          const currentDocuments = documentsRef.current
          const index = currentDocuments.findIndex((document) => document.id === id)
          if (index < 0) return
          const removed = currentDocuments[index]
          const nextDocuments = removeDocumentFromLibrary(currentDocuments, id)
          documentsRef.current = nextDocuments
          setDocuments(nextDocuments)
          showToast('Removed from library', {
            actionLabel: 'Restore',
            undo: { document: removed, index },
          })
        }}
        onSearch={setSearch}
        onSelect={synchronizeSelection}
        search={search}
        selectedId={selectedId}
      />
      <Workspace
        document={selectedDocument}
        focusMode={focusMode}
        inspectorOpen={inspectorOpen}
        mode={mode}
        onDocumentChange={updateDocument}
        onFocusMode={() => setFocusMode((current) => !current)}
        onInspector={() => setInspectorOpen((current) => !current)}
        onMode={setMode}
        onNew={createDocument}
        onOpen={importDocument}
        onSave={() => void saveDocument()}
        saveState={saveState}
        textareaRef={textareaRef}
      />
      {inspectorOpen && (
        <Inspector
          activeId={activeOutlineId}
          document={selectedDocument}
          onClose={() => setInspectorOpen(false)}
          onNavigate={navigateOutline}
          onSearch={setOutlineSearch}
          outline={outline}
          search={outlineSearch}
        />
      )}

      {loading && <div className="loading-bar" aria-label="Loading library"><span /></div>}
      {error && (
        <div className="error-banner" role="alert">
          <Icon name="warning" size={17} />
          <span>{error}</span>
          {error.includes('Use Save As') && (
            <button
              className="error-action"
              onClick={() => {
                const defaultToDocuments = error === ATOMIC_SAVE_UNAVAILABLE_MESSAGE
                setError(null)
                void saveDocument(true, true, defaultToDocuments)
              }}
              type="button"
            >Save As…</button>
          )}
          <button aria-label="Dismiss error" className="error-dismiss" onClick={() => setError(null)} type="button"><Icon name="close" size={14} /></button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button className="toast-action" onClick={restoreLastLibraryRemove} type="button">
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
