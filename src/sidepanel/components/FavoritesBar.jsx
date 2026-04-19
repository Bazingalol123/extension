import React, { useState, useRef, useEffect } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback, urlsMatch } from '@shared/utils.js'

// ─── FavoriteRow ─────────────────────────────────────────────────────────────

export function FavoriteRow({ fav, accentColor, isDragging, inFolder }) {
  const {
    removeFavorite, activateFavoriteUrl, renameFavorite, closeFavoriteTab,
    tabs, myWindowId,
  } = useStore()

  const [imgError, setImgError] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(fav.title || '')
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = useRef(null)
  const inputRef = useRef(null)

  const hasTabInThisWindow = tabs.some((t) =>
    t.windowId === myWindowId && urlsMatch(t.url, fav.url)
  )

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
    if (e.target.closest('.fav-action-btn')) return // button clicks handled separately
    activateFavoriteUrl(fav.url)
  }

  const handleActionClick = (e) => {
    e.stopPropagation()
    if (hasTabInThisWindow) {
      // [-] close the tab in this window (keep favorite)
      closeFavoriteTab(fav.url)
    } else {
      // [x] delete the favorite
      removeFavorite(fav.id)
    }
  }

  return (
    <>
      <div
        className={`favorite-row${hasTabInThisWindow ? ' is-active' : ''}${inFolder ? ' in-folder' : ''}${isDragging ? ' is-dragging' : ''}`}
        style={{ '--accent-color': accentColor, opacity: isDragging ? 0.5 : 1 }}
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

        <button
          className={`fav-action-btn ${hasTabInThisWindow ? 'action-minus' : 'action-x'}`}
          onClick={handleActionClick}
          title={
            hasTabInThisWindow
              ? 'Close tab (keep favorite)'
              : 'Delete favorite'
          }
        >
          {hasTabInThisWindow ? '−' : '×'}
        </button>
      </div>

      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { activateFavoriteUrl(fav.url); setCtxMenu(null) }}>
            Open
          </div>
          <div className="ctx-item" onClick={() => { setEditing(true); setCtxMenu(null) }}>
            Rename
          </div>
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

// ─── FolderRow ───────────────────────────────────────────────────────────────

function FolderRow({ folder, accentColor, children, childCount }) {
  const { toggleFavoriteFolder, renameFavoriteFolder, deleteFavoriteFolder, favoriteFolderState } = useStore()
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
        onClick={() => !editing && toggleFavoriteFolder(folder.id)}
        onDoubleClick={() => { setDraft(folder.title); setEditing(true) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: e.clientY })
        }}
      >
        <span className={`folder-chevron${collapsed ? ' collapsed' : ''}`}>▾</span>
        <span className="folder-icon">📁</span>
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
          <>
            <span className="folder-name">{folder.title}</span>
            <span className="folder-count">{childCount}</span>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="folder-children">{children}</div>
      )}

      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
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

export default function FavoritesBar({ favorites, folders, accentColor }) {
  const { createFavoriteFolder, bookmarksFailed } = useStore()
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'favorites-droppable' })

  // Partition favorites by parent: top-level vs inside each folder
  const topLevelFavs = favorites
    .filter((f) => !folders.some((fd) => fd.id === f.parentId))
    .sort((a, b) => a.order - b.order)

  const favsByFolder = new Map()
  for (const folder of folders) {
    favsByFolder.set(folder.id, favorites.filter((f) => f.parentId === folder.id).sort((a, b) => a.order - b.order))
  }

  // Flat id list for SortableContext — top-level favs + folders (folders sortable as blocks)
  const topLevelItems = [
    ...folders.sort((a, b) => a.order - b.order).map((f) => `folder-${f.id}`),
    ...topLevelFavs.map((f) => f.id),
  ]

  return (
    <div ref={setDropRef} className={`favorites-bar v2${isOver ? ' drop-target' : ''}`}>
      {bookmarksFailed && (
        <div className="bookmarks-warning">
          Favorites sync with Brave bookmarks is unavailable.
        </div>
      )}

      {(topLevelFavs.length > 0 || folders.length > 0) && (
        <div className="fav-section-label">Favorites</div>
      )}

      <SortableContext items={topLevelItems} strategy={verticalListSortingStrategy}>
        <div className="favorites-list">
          {folders.sort((a, b) => a.order - b.order).map((folder) => {
            const children = favsByFolder.get(folder.id) || []
            return (
              <FolderRow key={folder.id} folder={folder} accentColor={accentColor} childCount={children.length}>
                <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {children.map((fav) => (
                    <SortableFavoriteRow key={fav.id} id={fav.id} fav={fav} accentColor={accentColor} inFolder />
                  ))}
                </SortableContext>
              </FolderRow>
            )
          })}
          {topLevelFavs.map((fav) => (
            <SortableFavoriteRow key={fav.id} id={fav.id} fav={fav} accentColor={accentColor} />
          ))}
          {topLevelFavs.length === 0 && folders.length === 0 && !bookmarksFailed && (
            <div className="favorites-empty">
              {isOver ? 'Drop here to add favorite' : 'No favorites yet — drag a tab here'}
            </div>
          )}
        </div>
      </SortableContext>

      <button
        className="favorites-add-folder-btn"
        onClick={(e) => { e.stopPropagation(); createFavoriteFolder('New folder') }}
        onPointerDown={(e) => e.stopPropagation()}
        title="New folder"
      >
        + New folder
      </button>
    </div>
  )
}