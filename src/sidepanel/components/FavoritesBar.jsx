import React, { useState } from 'react'
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback } from '@shared/utils.js'

/**
 * Individual favorite tile.
 */
export function FavTile({ fav, isDragging, accentColor }) {
  const { removeFavorite, activateFavoriteUrl } = useStore()
  const [imgError, setImgError] = useState(false)
  const [hover, setHover]       = useState(false)
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = React.useRef(null)

  const favicon  = getFaviconSrc(fav.favIconUrl)
  const fallback = getFaviconFallback(fav.title, fav.url)

  React.useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  return (
    <>
      <div
        className="fav-tile"
        style={{ opacity: isDragging ? 0.5 : 1 }}
        onClick={() => activateFavoriteUrl(fav.url)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 170), y: e.clientY })
        }}
        title={fav.title}
      >
        {favicon && !imgError ? (
          <img className="fav-img" src={favicon} onError={() => setImgError(true)} alt="" />
        ) : (
          <span className="fav-initial" style={{ background: fallback.color }}>
            {fallback.letter}
          </span>
        )}
        {hover && !isDragging && (
          <span className="fav-tooltip">{fav.title || fav.url}</span>
        )}
      </div>
      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { activateFavoriteUrl(fav.url); setCtxMenu(null) }}>
            Open
          </div>
          <div className="ctx-separator" />
          <div className="ctx-item danger" onClick={() => { removeFavorite(fav.id); setCtxMenu(null) }}>
            Remove from Favorites
          </div>
        </div>
      )}
    </>
  )
}

function SortableFavTile({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
    >
      <FavTile {...props} />
    </div>
  )
}

/**
 * Favorites bar — always renders a droppable zone (even when empty) so that
 * the first favorite can be added by dragging a tab here.
 * Bug fix: previously returned null when empty, hiding the drop zone.
 */
export default function FavoritesBar({ favorites, accentColor }) {
  const sorted = [...favorites].sort((a, b) => a.order - b.order)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'favorites-droppable' })

  return (
    <div
      ref={setDropRef}
      className={`favorites-bar${isOver ? ' drop-target' : ''}`}
    >
      {sorted.length > 0 && (
        <div className="fav-section-label">Favorites</div>
      )}
      <SortableContext items={sorted.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
        <div className="fav-grid">
          {sorted.map((fav) => (
            <SortableFavTile
              key={fav.id}
              id={fav.id}
              fav={fav}
              accentColor={accentColor}
            />
          ))}
          {sorted.length === 0 && isOver && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 2px' }}>
              Drop here to add favorite
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}