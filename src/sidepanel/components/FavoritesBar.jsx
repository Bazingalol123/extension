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


// ─── FavoriteRow ─────────────────────────────────────────────────────────────

export function FavoriteRow({ fav, accentColor, isDragging, inFolder, depth =0  }) {
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
    if (isDrifted) return  // drifted rows are click-disabled; user must reset or [-]
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
        className={`favorite-row${isActive ? ' is-active' : ''}${isDrifted ? ' is-drifted' : ''}${isDragging ? ' is-dragging' : ''}`}
        style={{ '--accent-color': accentColor, opacity: isDragging ? 0.5 : 1, paddingLeft: `${8 + depth * 16}px` }}
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
    >
      <FolderRow folder={folder} dragHandleListeners={listeners} {...props} />
    </div>
  )
}



// ─── FolderRow ───────────────────────────────────────────────────────────────

function FolderRow({ folder, accentColor, children, childCount, depth = 0, dragHandleListeners }) {
  const { toggleFavoriteFolder, renameFavoriteFolder, deleteFavoriteFolder, createFavoriteFolder, favoriteFolderState } = useStore()
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
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => !editing && toggleFavoriteFolder(folder.id)}
        onDoubleClick={() => { setDraft(folder.title); setEditing(true) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: e.clientY })
        }}
      >
        <span
          className="folder-drag-handle"
          {...(dragHandleListeners || {})}
          onClick={(e) => e.stopPropagation()}
          title="Drag to move folder"
        >⋮⋮</span>
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

/**
 * Build a recursive tree from flat folders + favorites arrays.
 * Returns an array of top-level nodes. Each node is either:
 *   { kind: 'folder', folder, children: Node[], favs: Favorite[] }
 *   { kind: 'fav', fav }
 * Children are sorted by order. Favs inside a folder live on that node.
 */
function buildTree(favorites, folders, rootId) {
  const childrenByParent = new Map()   // parentId -> folder[]
  const favsByParent     = new Map()   // parentId -> favorite[]

  for (const folder of folders) {
    if (!childrenByParent.has(folder.parentId)) childrenByParent.set(folder.parentId, [])
    childrenByParent.get(folder.parentId).push(folder)
  }
  for (const fav of favorites) {
    if (!favsByParent.has(fav.parentId)) favsByParent.set(fav.parentId, [])
    favsByParent.get(fav.parentId).push(fav)
  }

  function buildFolderNode(folder) {
    const subFolders = (childrenByParent.get(folder.id) || []).sort((a, b) => a.order - b.order)
    const subFavs    = (favsByParent.get(folder.id) || []).sort((a, b) => a.order - b.order)
    return {
      kind: 'folder',
      folder,
      children: subFolders.map(buildFolderNode),
      favs: subFavs,
    }
  }

  const topFolders = (childrenByParent.get(rootId) || []).sort((a, b) => a.order - b.order)
  const topFavs    = (favsByParent.get(rootId) || []).sort((a, b) => a.order - b.order)

  return [
    ...topFolders.map(buildFolderNode),
    ...topFavs.map(fav => ({ kind: 'fav', fav })),
  ]
}

/**
 * Flatten a tree into the id list needed for SortableContext.
 * This is the DnD order: folder ids use 'fav-folder-<id>', fav ids use bare id.
 */
function flattenForSortable(tree) {
  const ids = []
  for (const node of tree) {
    if (node.kind === 'folder') {
      ids.push(`fav-folder-${node.folder.id}`)
      // We could recurse and put child ids here too, but SortableContext treats
      // child favs as their own context inside the folder, so top-level list
      // only needs top-level folders + top-level favs.
    } else {
      ids.push(node.fav.id)
    }
  }
  return ids
}

// Recursive node renderer
function FavoritesTreeNode({ node, accentColor, depth = 0 }) {
  if (node.kind === 'fav') {
    return <SortableFavoriteRow id={node.fav.id} fav={node.fav} accentColor={accentColor} depth={depth} />
  }
  // Folder node
  return (
    <SortableFolderRow folder={node.folder} accentColor={accentColor} depth={depth} childCount={countFolderItems(node)}>
      <SortableContext items={[...node.children.map(c => `fav-folder-${c.folder.id}`), ...node.favs.map(f => f.id)]} strategy={verticalListSortingStrategy}>
        {node.children.map((child) => (
          <FavoritesTreeNode key={child.folder.id} node={child} accentColor={accentColor} depth={depth + 1} />
        ))}
        {node.favs.map((fav) => (
          <SortableFavoriteRow key={fav.id} id={fav.id} fav={fav} accentColor={accentColor} depth={depth + 1} />
        ))}
      </SortableContext>
    </SortableFolderRow>
  )
}

function countFolderItems(node) {
  let count = node.favs.length
  for (const child of node.children) count += countFolderItems(child)
  return count
}

export default function FavoritesBar({ favorites, folders, accentColor, favoritesRootId, depth = 0 }) {
  const { createFavoriteFolder, bookmarksFailed } = useStore()
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