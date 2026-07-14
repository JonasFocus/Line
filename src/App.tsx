import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { extractOutline, MarkdownPreview, type OutlineItem } from './components/MarkdownPreview'
import { seedDocuments as coreSeedDocuments, seedFolders } from './data'
import { parseMarkdownMetadata } from './lib'
import { LatestTaskQueue } from './latestTaskQueue'
import { resolveSelectionAfterDocumentsChange, resolveVisibleSelection } from './selection'

export interface LineDocument {
  id: string
  title: string
  content: string
  folder: string
  tags: string[]
  favorite: boolean
  updatedAt: string
  path: string | null
  revision: string | null
  dirty?: boolean
}

type EditorMode = 'edit' | 'split' | 'preview'
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
type SaveRequest = {
  defaultToDocuments: boolean
  document: LineDocument
  saveAs: boolean
  saveCopy: boolean
}

const folderNameById = new Map(seedFolders.map((folder) => [folder.id, folder.name]))

function formatDate(value: string | null | undefined) {
  if (!value) return 'Just now'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const seedDocuments: LineDocument[] = coreSeedDocuments.map((document) => ({
  id: document.id,
  title: document.title,
  content: document.content,
  folder: folderNameById.get(document.folderId) || 'Basics',
  tags: document.tags,
  favorite: document.isStarred,
  updatedAt: formatDate(document.updatedAt),
  path: null,
  revision: null,
}))

const folders = seedFolders
  .filter((folder) => !folder.system)
  .map((folder) => ({
    name: folder.name,
    count: coreSeedDocuments.filter((document) => document.folderId === folder.id || seedFolders.find((child) => child.id === document.folderId)?.parentId === folder.id).length,
    nested: folder.name === 'TestFlight' || folder.name === 'Work',
    indent: Boolean(folder.parentId),
  }))

const lineApi = () => typeof window !== 'undefined' ? window.line : undefined

function isDocument(value: unknown): value is LineDocument {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string'
}

const STORAGE_KEY = 'line.library.v1'
const DOCUMENT_CONFLICT_MESSAGE =
  'This document changed on disk. Use Save As to keep your version without overwriting the external changes.'
const ATOMIC_SAVE_UNAVAILABLE_MESSAGE =
  'This document cannot be safely saved at its current location. Use Save As to keep your version.'

function readPersistedDocuments(): LineDocument[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return seedDocuments
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return seedDocuments
    const restored = parsed.filter(isDocument).map((document) => ({ ...document, path: null }))
    return restored.length ? restored : seedDocuments
  } catch {
    return seedDocuments
  }
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
  return {
    id: typeof item.id === 'string' ? item.id : `import-${Date.now()}`,
    title,
    content: item.content,
    folder: typeof item.folder === 'string' ? item.folder : 'Basics',
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : metadata.tags,
    favorite: Boolean(item.favorite),
    updatedAt: formatDate(typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.modifiedAt === 'string' ? item.modifiedAt : null),
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
    <button className={`icon-button ${active ? 'is-active' : ''} ${className}`} disabled={disabled} onClick={onClick} title={label} type="button">
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
  const favorites = documents.filter((doc) => doc.favorite).slice(0, 4)
  const tags = Array.from(new Set(documents.flatMap((doc) => doc.tags)))

  return (
    <aside className="sidebar pane">
      <header className="sidebar-header titlebar-region">
        <TrafficLights />
        <div className="sidebar-header-actions no-drag">
          <PlainButton icon="folderAdd" label="Import files" onClick={onOpenFolder} />
          <PlainButton disabled icon="panel" label="Sidebar toggle is not available in this MVP" />
        </div>
      </header>

      <div className="sidebar-scroll">
        <section className="nav-section">
          <p className="section-label">Starred</p>
          {favorites.map((doc) => (
            <button className="nav-row starred-row" key={doc.id} onClick={() => onFilter(`doc:${doc.id}`)} type="button">
              <Icon filled name="star" size={16} />
              <span>{doc.title}</span>
            </button>
          ))}
        </section>

        <section className="nav-section">
          <p className="section-label">Documents</p>
          <button className={`nav-row ${activeFilter === 'all' ? 'selected' : ''}`} onClick={() => onFilter('all')} type="button">
            <span className="chevron-spacer" /><Icon name="grid" size={16} /><span>All Documents</span>
          </button>
          {folders.map((folder) => (
            <button
              className={`nav-row ${folder.indent ? 'is-indented' : ''} ${activeFilter === folder.name ? 'selected' : ''}`}
              key={folder.name}
              onClick={() => onFilter(folder.name)}
              type="button"
            >
              {folder.nested ? <Icon name="chevronRight" size={13} /> : <span className="chevron-spacer" />}
              <Icon name={folder.name === 'Archive' ? 'archive' : 'folder'} size={17} />
              <span>{folder.name}</span><small>{folder.count}</small>
            </button>
          ))}
          <button className={`nav-row ${activeFilter === 'trash' ? 'selected' : ''}`} onClick={() => onFilter('trash')} type="button">
            <span className="chevron-spacer" /><Icon name="trash" size={17} /><span>Recently Deleted</span><small>14</small>
          </button>
        </section>

        <section className="nav-section tag-section">
          <p className="section-label">Tags</p>
          <div className="tag-cloud">
            <button className={!activeTag ? 'selected-tag' : ''} onClick={() => onTag(null)} type="button">All Tags</button>
            {tags.map((tag) => <button className={activeTag === tag ? 'selected-tag' : ''} key={tag} onClick={() => onTag(tag)} type="button">#{tag}</button>)}
          </div>
        </section>
      </div>
    </aside>
  )
}

function DocumentList({ documents, selectedId, search, onSearch, onSelect, onFavorite, onNew, onImport }: {
  documents: LineDocument[]
  selectedId: string | null
  search: string
  onSearch: (value: string) => void
  onSelect: (id: string) => void
  onFavorite: (id: string) => void
  onNew: () => void
  onImport: () => void
}) {
  return (
    <section className="document-pane pane">
      <header className="document-toolbar titlebar-region">
        <div className="document-heading">Library</div>
        <div className="toolbar-group no-drag">
          <PlainButton icon="newDocument" label="New document" onClick={onNew} />
          <PlainButton icon="import" label="Import Markdown" onClick={onImport} />
          <PlainButton disabled icon="sort" label="Sorting is not available in this MVP" />
        </div>
      </header>

      <div className="document-search">
        <Icon name="search" size={15} />
        <input aria-label="Search documents" onChange={(event) => onSearch(event.target.value)} placeholder="Search documents" value={search} />
        {search && <button aria-label="Clear search" onClick={() => onSearch('')} type="button"><Icon name="close" size={13} /></button>}
      </div>

      <div className="document-list">
        {documents.length ? documents.map((doc, index) => (
          <div
            className={`document-card ${selectedId === doc.id ? 'selected' : ''}`}
            key={doc.id}
            style={{ '--list-index': index } as React.CSSProperties}
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
            <strong>No notes found</strong>
            <p>Try a different folder or search, or create a new document.</p>
            <button onClick={onNew} type="button">New document</button>
          </div>
        )}
      </div>
    </section>
  )
}

function ModeControl({ mode, onMode }: { mode: EditorMode; onMode: (mode: EditorMode) => void }) {
  const modes: { mode: EditorMode; icon: IconName; label: string }[] = [
    { mode: 'edit', icon: 'edit', label: 'Editor' },
    { mode: 'split', icon: 'split', label: 'Split view' },
    { mode: 'preview', icon: 'eye', label: 'Preview' },
  ]
  return <div className="segmented mode-control">{modes.map((item) => <PlainButton active={mode === item.mode} icon={item.icon} key={item.mode} label={item.label} onClick={() => onMode(item.mode)} />)}</div>
}

function Workspace({ document, mode, saveState, textareaRef, onDocumentChange, onMode, onSave, inspectorOpen, onInspector }: {
  document: LineDocument | null
  mode: EditorMode
  saveState: SaveState
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onDocumentChange: (change: Partial<LineDocument>) => void
  onMode: (mode: EditorMode) => void
  onSave: () => void
  inspectorOpen: boolean
  onInspector: () => void
}) {
  const wordCount = document?.content.trim() ? document.content.trim().split(/\s+/).length : 0
  return (
    <main className="workspace pane">
      <header className="workspace-toolbar titlebar-region">
        <div className="workspace-title-wrap no-drag">
          <Icon name="document" size={15} />
          <span>{document?.title || 'No document selected'}</span>
        </div>
        <div className="workspace-center no-drag"><ModeControl mode={mode} onMode={onMode} /></div>
        <div className="workspace-actions no-drag">
          <button className={`save-status ${saveState}`} onClick={onSave} type="button">
            <Icon name="save" size={16} />
            <span>{saveState === 'saving' ? 'Saving' : saveState === 'dirty' ? 'Save' : saveState === 'error' ? 'Retry' : 'Saved'}</span>
          </button>
          <PlainButton active={inspectorOpen} icon="inspector" label="Toggle inspector" onClick={onInspector} />
          <PlainButton disabled icon="share" label="Sharing is not available in this MVP" />
          <PlainButton disabled icon="dots" label="More options are not available in this MVP" />
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
                ref={textareaRef}
                spellCheck
                value={document.content}
              />
            </div>
          )}
          {mode !== 'edit' && <div className="preview-column" data-preview-scroll><MarkdownPreview markdown={document.content} /></div>}
          <footer className="editor-footer"><span>{wordCount.toLocaleString()} words</span><span>{document.dirty ? 'Edited' : 'Markdown'}</span></footer>
        </div>
      ) : (
        <div className="workspace-empty">
          <span><Icon name="edit" size={28} /></span>
          <h2>Space to think, space to write</h2>
          <p>Select a note from your library or start with a blank page.</p>
        </div>
      )}
    </main>
  )
}

function Inspector({ document, outline, activeId, search, onSearch, onNavigate, onClose }: {
  document: LineDocument | null
  outline: OutlineItem[]
  activeId: string | null
  search: string
  onSearch: (value: string) => void
  onNavigate: (item: OutlineItem) => void
  onClose: () => void
}) {
  const visibleOutline = outline.filter((item) => item.text.toLowerCase().includes(search.toLowerCase()))
  return (
    <aside className="inspector pane">
      <header className="inspector-toolbar titlebar-region">
        <label className="inspector-search no-drag"><Icon name="search" size={16} /><input aria-label="Search outline" onChange={(event) => onSearch(event.target.value)} placeholder="Search" value={search} /></label>
      </header>
      <div className="inspector-body">
        <div className="inspector-document-title"><strong>{document?.title || 'No document'}</strong><PlainButton icon="close" label="Close inspector" onClick={onClose} /></div>
        <div className="inspector-tabs" role="tablist">
          <button aria-label="Document outline" aria-selected="true" className="active" role="tab" type="button"><Icon name="list" size={16} /></button>
          <button aria-label="Links, coming soon" aria-selected="false" disabled role="tab" type="button"><Icon name="link" size={16} /></button>
          <button aria-label="Tags, coming soon" aria-selected="false" disabled role="tab" type="button"><Icon name="tag" size={16} /></button>
          <button aria-label="Inspector search, coming soon" aria-selected="false" disabled role="tab" type="button"><Icon name="search" size={16} /></button>
        </div>
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
    </aside>
  )
}

export default function App() {
  const [documents, setDocuments] = useState<LineDocument[]>(readPersistedDocuments)
  const [selectedId, setSelectedId] = useState<string | null>(() => readPersistedDocuments()[0]?.id || null)
  const [activeFilter, setActiveFilter] = useState('Basics')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [outlineSearch, setOutlineSearch] = useState('')
  const [mode, setMode] = useState<EditorMode>('edit')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toastTimer = useRef<number | null>(null)
  const saveQueueRef = useRef(new LatestTaskQueue<SaveRequest>())
  const externalFilesReadyRef = useRef(false)
  const documentsRef = useRef(documents)
  const selectedIdRef = useRef(selectedId)

  documentsRef.current = documents
  selectedIdRef.current = selectedId

  const selectedDocument = documents.find((document) => document.id === selectedId) || null
  const outline = useMemo(() => extractOutline(selectedDocument?.content || ''), [selectedDocument?.content])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const acceptExternalDocuments = useCallback((externalDocuments: unknown[]) => {
    const opened = externalDocuments.map(normalizeImported).filter((document): document is LineDocument => document !== null)
    if (!opened.length) return
    const { documents: safeOpened, protectedCount } = reconcileOpenedDocuments(documentsRef.current, opened)
    const openedIds = new Set(safeOpened.map((document) => document.id))
    setDocuments((current) => [...safeOpened, ...current.filter((document) => !openedIds.has(document.id))])
    setSelectedId(safeOpened[0].id)
    setError(null)
    setSaveState(safeOpened[0].dirty ? 'dirty' : 'idle')
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
    return documents.filter((document) => {
      if (activeFilter === 'trash') return false
      if (activeFilter.startsWith('doc:') && document.id !== activeFilter.slice(4)) return false
      if (!['all', 'trash'].includes(activeFilter) && !activeFilter.startsWith('doc:') && document.folder !== activeFilter) return false
      if (activeTag && !document.tags.includes(activeTag)) return false
      if (!query) return true
      return `${document.title} ${document.content} ${document.tags.join(' ')}`.toLowerCase().includes(query)
    })
  }, [documents, activeFilter, activeTag, search])

  const synchronizeSelection = useCallback((nextSelectedId: string | null) => {
    if (nextSelectedId === selectedIdRef.current) return

    const nextDocument = documentsRef.current.find((document) => document.id === nextSelectedId)
    selectedIdRef.current = nextSelectedId
    setSelectedId(nextSelectedId)
    setError(null)
    setSaveState(nextDocument?.dirty ? 'dirty' : 'idle')
    setActiveOutlineId(null)
  }, [])

  const updateDocument = useCallback((change: Partial<LineDocument>) => {
    if (!selectedId) return
    const metadata = typeof change.content === 'string' ? parseMarkdownMetadata(change.content) : null
    setDocuments((current) => current.map((document) => document.id === selectedId ? {
      ...document,
      ...change,
      ...(metadata ? { title: metadata.title, tags: metadata.tags } : {}),
      dirty: true,
      updatedAt: 'Just now',
    } : document))
    setSaveState('dirty')
  }, [selectedId])

  const createDocument = useCallback(async () => {
    const draft: LineDocument = {
      id: `note-${Date.now()}`,
      title: 'Untitled',
      content: '# Untitled\n\nStart writing here.',
      folder: activeFilter !== 'all' && !activeFilter.startsWith('doc:') && activeFilter !== 'trash' ? activeFilter : 'Basics',
      tags: [],
      favorite: false,
      updatedAt: 'Just now',
      path: null,
      revision: null,
      dirty: true,
    }
    try {
      const result = await lineApi()?.createBlankDocument?.()
      const shellDocument = normalizeImported(result)
      const created = shellDocument ? { ...draft, id: shellDocument.id, path: shellDocument.path } : draft
      setDocuments((current) => [created, ...current])
      setSelectedId(created.id)
      setError(null)
      setActiveFilter('all')
      setActiveTag(null)
      setSearch('')
      setSaveState(created.dirty ? 'dirty' : 'idle')
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the document.')
    }
  }, [activeFilter])

  const importDocument = useCallback(async () => {
    const api = lineApi()
    if (!api?.openFiles && !api?.importMarkdown) {
      showToast('Import is available in the desktop app')
      return
    }
    setLoading(true)
    try {
      const result = api.openFiles ? await api.openFiles({ multiple: true }) : [await api.importMarkdown?.()]
      const imported = result.map(normalizeImported).filter((document): document is LineDocument => document !== null)
      if (!imported.length) return
      const { documents: safeImported, protectedCount } = reconcileOpenedDocuments(documentsRef.current, imported)
      const importedIds = new Set(safeImported.map((document) => document.id))
      setDocuments((current) => [...safeImported, ...current.filter((document) => !importedIds.has(document.id))])
      setSelectedId(safeImported[0].id)
      setError(null)
      setActiveFilter('all')
      setActiveTag(null)
      setSearch('')
      if (protectedCount > 0) {
        showToast('Kept your unsaved version of an open document')
      } else {
        showToast(safeImported.length === 1 ? 'Markdown imported' : `${safeImported.length} documents imported`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import that file.')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const saveDocument = useCallback(async (saveAs = false, saveCopy = false, defaultToDocuments = false) => {
    if (!selectedDocument) return

    const request = { defaultToDocuments, document: selectedDocument, saveAs, saveCopy }
    await saveQueueRef.current.run(selectedDocument.id, request, async ({
      defaultToDocuments: requestedDocumentsDefault,
      document: documentToSave,
      saveAs: requestedSaveAs,
      saveCopy: requestedSaveCopy,
    }) => {
      const submittedContent = documentToSave.content
      if (selectedIdRef.current === documentToSave.id) setSaveState('saving')

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
        const result = requestedSaveAs ? await api?.saveFileAs?.(saveInput) : await api?.saveDocument?.(saveInput)
        if (api && result === null) {
          if (selectedIdRef.current === documentToSave.id) {
            setSaveState(documentToSave.dirty ? 'dirty' : 'idle')
          }
          return { continueWithPending: false }
        }

        const saved = normalizeImported(result)
        const latestDocument = documentsRef.current.find((document) => document.id === documentToSave.id)
        const hasNewerChanges = latestDocument?.content !== submittedContent
        setDocuments((current) => current.map((document) => document.id === documentToSave.id ? {
          ...document,
          path: saved?.path ?? document.path,
          revision: saved?.revision ?? document.revision,
          updatedAt: saved?.updatedAt ?? document.updatedAt,
          dirty: hasNewerChanges ? document.dirty : false,
        } : document))
        if (selectedIdRef.current === documentToSave.id) {
          setSaveState(hasNewerChanges ? 'dirty' : 'saved')
        }
        showToast(hasNewerChanges ? 'Saved earlier edits; newer changes remain' : api ? 'Saved to disk' : 'Changes saved for this session')
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
        if (selectedIdRef.current === documentToSave.id) {
          setSaveState(recoveryMessage ? 'dirty' : 'error')
          setError(recoveryMessage || message || 'The document could not be saved.')
        }
        return { continueWithPending: false }
      }
    })
  }, [selectedDocument, showToast])

  const openFolder = importDocument

  const navigateOutline = useCallback((item: OutlineItem) => {
    setActiveOutlineId(item.id)
    if (mode !== 'edit') {
      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const source = selectedDocument?.content || ''
    const start = source.split('\n').slice(0, item.line).join('\n').length + (item.line ? 1 : 0)
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(start, start)
    if (textareaRef.current) textareaRef.current.scrollTop = Math.max(0, item.line * 28 - 80)
  }, [mode, selectedDocument?.content])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents.map((document) => ({ ...document, path: null }))))
      } catch {
        // The editor remains fully usable if browser storage is unavailable.
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [documents])

  useEffect(() => {
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (!documents.some((document) => document.dirty)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnAboutUnsavedChanges)
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges)
  }, [documents])

  useEffect(() => {
    const handleAction = (action: string) => {
      if (action === 'new') void createDocument()
      if (action === 'open' || action === 'import') void importDocument()
      if (action === 'save') void saveDocument()
      if (action === 'save-as') void saveDocument(true)
      if (action === 'toggle-inspector') setInspectorOpen((current) => !current)
    }
    const api = lineApi()
    const disposeMenu = api?.onMenuCommand?.(handleAction)
    const disposeExternal = api?.onExternalFilesOpened?.(acceptExternalDocuments)
    if (api?.readyForExternalFiles && !externalFilesReadyRef.current) {
      externalFilesReadyRef.current = true
      void api.readyForExternalFiles()
        .then(acceptExternalDocuments)
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not open files from Finder.'))
    }
    return () => {
      if (typeof disposeMenu === 'function') disposeMenu()
      if (typeof disposeExternal === 'function') disposeExternal()
    }
  }, [acceptExternalDocuments, createDocument, importDocument, saveDocument])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); void createDocument() }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void importDocument() }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void saveDocument(event.shiftKey) }
      if (event.key.toLowerCase() === 'f' && !event.shiftKey) {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.document-search input')
        input?.focus()
      }
      if (event.key.toLowerCase() === 'i' && event.shiftKey) { event.preventDefault(); setInspectorOpen((current) => !current) }
      if (event.key === '1') setMode('edit')
      if (event.key === '2') setMode('split')
      if (event.key === '3') setMode('preview')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [createDocument, importDocument, saveDocument])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    const nextSelectedId = resolveVisibleSelection(
      selectedIdRef.current,
      filteredDocuments.map((document) => document.id),
    )
    synchronizeSelection(nextSelectedId)
    // Document edits can change search and tag membership while the user types.
    // Reconcile here only when navigation controls change.
  }, [activeFilter, activeTag, search, synchronizeSelection])

  useEffect(() => {
    const nextSelectedId = resolveSelectionAfterDocumentsChange(
      selectedIdRef.current,
      documents.map((document) => document.id),
      filteredDocuments.map((document) => document.id),
    )
    synchronizeSelection(nextSelectedId)
  }, [documents, synchronizeSelection])

  return (
    <div className={`app-shell ${inspectorOpen ? 'inspector-visible' : 'inspector-hidden'}`}>
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
          }
        }}
        onOpenFolder={openFolder}
        onTag={setActiveTag}
      />
      <DocumentList
        documents={filteredDocuments}
        onFavorite={(id) => setDocuments((current) => current.map((document) => document.id === id ? { ...document, favorite: !document.favorite } : document))}
        onImport={importDocument}
        onNew={createDocument}
        onSearch={setSearch}
        onSelect={synchronizeSelection}
        search={search}
        selectedId={selectedId}
      />
      <Workspace
        document={selectedDocument}
        inspectorOpen={inspectorOpen}
        mode={mode}
        onDocumentChange={updateDocument}
        onInspector={() => setInspectorOpen((current) => !current)}
        onMode={setMode}
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
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
