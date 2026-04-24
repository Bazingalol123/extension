import React, { useState, useRef, useEffect } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback, urlsMatch } from '@shared/utils.js'

function RootDropTarget() {
  const { setNodeRef, isOver } = useDroppable({ id: 'favorites-root-drop' })
  return (
    <div
      ref={setNodeRef}
      className={`favorites-root-drop${isOver ? ' drop-target' : ''}`}
      style={{
        height: 8,
        margin: '2px 0',
        borderRadius: 4,
        background: isOver ? 'var(--accent-color, #7C6AF7)' : 'transparent',
        opacity: isOver ? 0.3 : 1,
      }}
    />
  )
}

// ─── Folder icon (Arc-inspired, purple outline, open/closed variants) ────────

function FolderIcon({ open = false }) {
  if (open) {
    return (
      <svg className="folder-svg-icon" width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z" />
        <path d="M3 9h18l-1.5 8a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 9z" />
      </svg>
    )
  }
  return (
    <svg className="folder-svg-icon" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

// ─── FavoriteRow ─────────────────────────────────────────────────────────────

export function FavoriteRow({ fav, accentColor, isDragging, activeTabId, inFolder, depth = 0 }) {
  const {
    removeFavorite, renameFavorite,
    activateFavorite, deactivateFavorite, resetFavoriteDrift,
    setFavoriteUrlToCurrent,
    favoriteOwnerships, myWindowId,
  } = useStore()

  const [imgError, setImgError] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(fav.title || '')
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = useRef(null)
  const inputRef = useRef(null)

  const ownership = (favoriteOwnerships || []).find(
    o => o.favId === fav.id && o.windowId === myWindowId
  )

  const isActive  = !!ownership
  const isDrifted = !!ownership?.drifted
  const isFocused = isActive && ownership?.tabId === activeTabId

  const favicon  = getFaviconSrc(fav.favIconUrl)
  const fallback = getFaviconFallback(fav.title, fav.url)

  useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== fav.title) renameFavorite(fav.id, next)
    setEditing(false)
  }

  const cancelRename = () => {
    setDraft(fav.title || '')
    setEditing(false)
  }

  const handleRowClick = (e) => {
    if (editing) return
    if (e.target.closest('.fav-action-btn')) return
    if (isDrifted) return
    activateFavorite(fav.id)
  }

  const handleActionClick = (e) => {
    e.stopPropagation()
    if (isActive) {
      deactivateFavorite(fav.id)
    } else {
      removeFavorite(fav.id)
    }
  }

  return (
    <>
      <div
        className={`favorite-row${isActive ? ' is-active' : ''}${isDrifted ? ' is-drifted' : ''}${isFocused ? ' is-focused' : ''}${isDragging ? ' is-dragging' : ''}`}
        style={{ '--accent-color': accentColor, opacity: isDragging ? 0.5 : 1, paddingLeft: `${10 + depth * 20}px` }}
        onClick={handleRowClick}
        onDoubleClick={(e) => {
          if (e.target.closest('.fav-action-btn')) return
          setDraft(fav.title || '')
          setEditing(true)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: e.clientY })
        }}
        title={editing ? undefined : (fav.title || fav.url)}
      >
        {favicon && !imgError ? (
          <img className="favorite-favicon" src={favicon} onError={() => setImgError(true)} alt="" />
        ) : (
          <span className="favorite-favicon fallback" style={{ background: fallback.color }}>
            {fallback.letter}
          </span>
        )}

        {editing ? (
          <input
            ref={inputRef}
            className="favorite-rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') cancelRename()
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="favorite-title">{fav.title || fav.url}</span>
        )}

        {isActive && isDrifted && (
          <button
            className="fav-action-btn action-reset"
            onClick={(e) => { e.stopPropagation(); resetFavoriteDrift(fav.id) }}
            title="Reset to original URL"
          >
            ↻
          </button>
        )}
        <button
          className={`fav-action-btn ${isActive ? 'action-minus' : 'action-x'}`}
          onClick={handleActionClick}
          title={isActive ? 'Close tab (keep favorite)' : 'Delete favorite'}
        >
          {isActive ? '−' : '×'}
        </button>
      </div>

      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { activateFavorite(fav.id); setCtxMenu(null) }}>
            Open
          </div>
          <div className="ctx-item" onClick={() => { setEditing(true); setCtxMenu(null) }}>
            Rename
          </div>
          {isDrifted && (
            <>
              <div className="ctx-separator" />
              <div className="ctx-item" onClick={() => { setFavoriteUrlToCurrent(fav.id); setCtxMenu(null) }}>
                Set URL to current tab
              </div>
              <div className="ctx-item" onClick={() => { resetFavoriteDrift(fav.id); setCtxMenu(null) }}>
                Reset to original URL
              </div>
            </>
          )}
          <div className="ctx-separator" />
          <div className="ctx-item danger" onClick={() => { removeFavorite(fav.id); setCtxMenu(null) }}>
            Delete favorite
          </div>
        </div>
      )}
    </>
  )
}

function SortableFavoriteRow({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <FavoriteRow isDragging={isDragging} {...props} />
    </div>
  )
}

function SortableFolderRow({ folder, ...props }) {
  const sortableId = `fav-folder-${folder.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      <FolderRow folder={folder} {...props} />
    </div>
  )
}

// ─── FolderRow ───────────────────────────────────────────────────────────────

function FolderRow({ folder, accentColor, children, depth = 0 }) {
  const { toggleFavoriteFolder, renameFavoriteFolder, deleteFavoriteFolder, createFavoriteFolder, favoriteFolderState, pendingRenameFolderId } = useStore()
  const collapsed = !!favoriteFolderState?.[folder.id]

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(folder.title)
  const [ctxMenu, setCtxMenu] = useState(null)
  const ctxRef   = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (pendingRenameFolderId === folder.id) {
      setDraft(folder.title)
      setEditing(true)
      useStore.setState({ pendingRenameFolderId: null })
    }
  }, [pendingRenameFolderId, folder.id, folder.title])

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `fav-folder-${folder.id}` })

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== folder.title) renameFavoriteFolder(folder.id, next)
    setEditing(false)
  }

  return (
    <div className={`favorite-folder${isOver ? ' drop-target' : ''}`} ref={setDropRef}>
      <div
        className="folder-header"
        style={{ paddingLeft: `${10 + depth * 20}px` }}
        onClick={() => !editing && toggleFavoriteFolder(folder.id)}
        onDoubleClick={() => { setDraft(folder.title); setEditing(true) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: e.clientY })
        }}
      >
        <span className={`folder-chevron${collapsed ? ' collapsed' : ''}`}>▾</span>
        <span className="folder-icon">
          <FolderIcon open={!collapsed} />
        </span>
        {editing ? (
          <input
            ref={inputRef}
            className="favorite-rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') { setDraft(folder.title); setEditing(false) }
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="folder-name">{folder.title}</span>
        )}
      </div>

      {!collapsed && (
        <div className="folder-children">{children}</div>
      )}

      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { createFavoriteFolder('New folder', folder.id); setCtxMenu(null) }}>
            New Nested Folder
          </div>
          <div className="ctx-item" onClick={() => { setEditing(true); setCtxMenu(null) }}>
            Rename
          </div>
          <div className="ctx-separator" />
          <div className="ctx-item danger" onClick={() => { deleteFavoriteFolder(folder.id); setCtxMenu(null) }}>
            Delete folder and contents
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FavoritesBar ────────────────────────────────────────────────────────────

function buildTree(favorites, folders, rootId) {
  const childrenByParent = new Map()
  const favsByParent     = new Map()

  for (const folder of folders) {
    if (!childrenByParent.has(folder.parentId)) childrenByParent.set(folder.parentId, [])
    childrenByParent.get(folder.parentId).push(folder)
  }
  for (const fav of favorites) {
    if (!favsByParent.has(fav.parentId)) favsByParent.set(fav.parentId, [])
    favsByParent.get(fav.parentId).push(fav)
  }

  function buildMixedChildren(parentId) {
    const folderChildren = childrenByParent.get(parentId) || []
    const favChildren    = favsByParent.get(parentId) || []
    const mixed = [
      ...folderChildren.map(f => ({ kind: 'folder', orderKey: f.order, folder: f })),
      ...favChildren.map(f => ({ kind: 'fav', orderKey: f.order, fav: f })),
    ].sort((a, b) => a.orderKey - b.orderKey)

    return mixed.map(node => {
      if (node.kind === 'folder') {
        return {
          kind: 'folder',
          folder: node.folder,
          children: buildMixedChildren(node.folder.id),
        }
      }
      return { kind: 'fav', fav: node.fav }
    })
  }

  return buildMixedChildren(rootId)
}

function flattenForSortable(tree) {
  const ids = []
  for (const node of tree) {
    if (node.kind === 'folder') {
      ids.push(`fav-folder-${node.folder.id}`)
    } else {
      ids.push(node.fav.id)
    }
  }
  return ids
}

function FavoritesTreeNode({ node, accentColor, depth = 0, activeTabId }) {
  if (node.kind === 'fav') {
    return <SortableFavoriteRow id={node.fav.id} fav={node.fav} accentColor={accentColor} depth={depth} activeTabId={activeTabId} />
  }
  const childIds = node.children.map(c =>
    c.kind === 'folder' ? `fav-folder-${c.folder.id}` : c.fav.id
  )
  return (
    <SortableFolderRow folder={node.folder} accentColor={accentColor} depth={depth}>
      <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
        {node.children.map((child) => (
          <FavoritesTreeNode
            key={child.kind === 'folder' ? child.folder.id : child.fav.id}
            node={child}
            accentColor={accentColor}
            depth={depth + 1}
            activeTabId={activeTabId}
          />
        ))}
      </SortableContext>
    </SortableFolderRow>
  )
}

export default function FavoritesBar({ favorites, folders, accentColor, favoritesRootId, depth = 0, activeTabId }) {
  const { bookmarksFailed } = useStore()
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'favorites-droppable' })

  const tree = buildTree(favorites, folders, favoritesRootId)
  const topLevelIds = flattenForSortable(tree)

  return (
    <div ref={setDropRef} className={`favorites-bar v2${isOver ? ' drop-target' : ''}`}>
      {bookmarksFailed && (
        <div className="bookmarks-warning">
          Favorites sync with Brave bookmarks is unavailable.
        </div>
      )}

      {tree.length > 0 && (
        <div className="fav-section-label">Favorites</div>
      )}

      <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
        <div className="favorites-list">
          {tree.map((node) => (
            <FavoritesTreeNode
              key={node.kind === 'folder' ? node.folder.id : node.fav.id}
              node={node}
              accentColor={accentColor}
              activeTabId={activeTabId}
            />
          ))}
          {tree.length === 0 && !bookmarksFailed && (
            <div className="favorites-empty">
              {isOver ? 'Drop here to add favorite' : 'No favorites yet — drag a tab here'}
            </div>
          )}
          {tree.length > 0 && <RootDropTarget />}
        </div>
      </SortableContext>
    </div>
  )
}