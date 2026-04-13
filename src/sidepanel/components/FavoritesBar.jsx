import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'

/**
 * Single favorite tile (non-sortable presentation).
 * Exported so App.jsx can render it inside the unified DragOverlay.
 */
export function FavTile({ fav, isDragging, accentColor }) {
  const { activateFavoriteUrl, removeFavorite } = useStore()

  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)

  const initial = (fav.title || fav.url || '?')[0].toUpperCase()
  const favIcon = fav.favIconUrl && !imgError ? fav.favIconUrl : null

  let hostname = fav.url
  try {
    hostname = new URL(fav.url).hostname.replace('www.', '')
  } catch {}

  const handleClick = (e) => {
    if (e.target.closest('.fav-ctx-menu')) return
    activateFavoriteUrl(fav.url)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setCtxMenu({ x: rect.right, y: rect.top })
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handleClickOutside = (e) => {
      if (!e.target.closest('.fav-ctx-menu')) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ctxMenu])

  return (
    <div
      className={`fav-tile${isDragging ? ' dragging' : ''}`}
      style={{ '--space-color': accentColor }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
      }}
    >
      {favIcon ? (
        <img
          src={favIcon}
          className="fav-img"
          alt=""
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="fav-initial">{initial}</span>
      )}

      {hovered && !ctxMenu && (
        <div className="fav-tooltip">{fav.title || hostname}</div>
      )}

      {ctxMenu && ReactDOM.createPortal(
        <div
          className="fav-ctx-menu"
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x }}
        >
          <div
            className="ctx-item"
            onClick={() => {
              activateFavoriteUrl(fav.url)
              setCtxMenu(null)
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
            Open
          </div>
          <div
            className="ctx-item"
            onClick={() => {
              chrome.tabs.create({ url: fav.url })
              setCtxMenu(null)
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in New Tab
          </div>
          <div className="ctx-separator" />
          <div
            className="ctx-item danger"
            onClick={() => {
              removeFavorite(fav.id)
              setCtxMenu(null)
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Remove Favorite
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Sortable wrapper for a single favorite tile.
 */
function SortableFavTile({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <FavTile {...props} />
    </div>
  )
}

/**
 * Horizontal favorites bar with drag-to-reorder support.
 * Uses SortableContext inside the parent DndContext (lifted to App.jsx).
 * Also acts as a droppable zone so tabs can be dropped here to add as favorites.
 */
export default function FavoritesBar({ favorites, accentColor }) {
  const sorted = [...favorites].sort((a, b) => a.order - b.order)

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'favorites-droppable' })

  if (favorites.length === 0) return null

  return (
    <div
      ref={setDropRef}
      className={`favorites-bar${isOver ? ' drop-target' : ''}`}
    >
      <SortableContext
        items={sorted.map((f) => f.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="fav-grid">
          {sorted.map((fav) => (
            <SortableFavTile
              key={fav.id}
              id={fav.id}
              fav={fav}
              accentColor={accentColor}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
