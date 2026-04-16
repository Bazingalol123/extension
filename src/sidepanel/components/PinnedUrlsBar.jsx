import React, { useState } from 'react'
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback, urlsMatch } from '@shared/utils.js'

/**
 * Individual pinned tile — shows open/closed state.
 * Open = accent border + green dot. Closed = dimmed.
 */
export function PinnedTile({ pin, accentColor, isOpen, matchingTab, dragging }) {
  const { unpinUrl } = useStore()
  const [imgError, setImgError] = useState(false)
  const [hover, setHover]       = useState(false)
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = React.useRef(null)

  const favicon  = getFaviconSrc(pin.favIconUrl)
  const fallback = getFaviconFallback(pin.title, pin.url)

  React.useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  const handleClick = () => {
    if (isOpen && matchingTab) {
      chrome.tabs.update(matchingTab.id, { active: true })
    } else {
      chrome.tabs.create({ url: pin.url })
    }
  }

  return (
    <>
      <div
        className={`pinned-url-tile${isOpen ? ' is-open' : ' is-closed'}`}
        style={{ '--space-color': accentColor, opacity: dragging ? 0.6 : undefined }}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 170), y: e.clientY })
        }}
      >
        {favicon && !imgError ? (
          <img className="pinned-img" src={favicon} onError={() => setImgError(true)} alt="" />
        ) : (
          <span className="pinned-initial" style={{ background: fallback.color }}>
            {fallback.letter}
          </span>
        )}
        {isOpen && <span className="pinned-live-dot" />}
        {hover && !dragging && (
          <span className="pinned-tooltip">{pin.title || pin.url}</span>
        )}
      </div>
      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { handleClick(); setCtxMenu(null) }}>
            {isOpen ? 'Switch to Tab' : 'Open'}
          </div>
          <div className="ctx-item" onClick={() => { chrome.tabs.create({ url: pin.url }); setCtxMenu(null) }}>
            Open New Tab
          </div>
          <div className="ctx-separator" />
          <div className="ctx-item danger" onClick={() => { unpinUrl(pin.id); setCtxMenu(null) }}>
            Unpin
          </div>
        </div>
      )}
    </>
  )
}

function SortablePinnedTile({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
    >
      <PinnedTile {...props} />
    </div>
  )
}

export default function PinnedUrlsBar({ pins, accentColor, tabs }) {
  const sorted = [...pins].sort((a, b) => a.order - b.order)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'pinned-droppable' })

  if (sorted.length === 0) return null

  return (
    <div
      ref={setDropRef}
      className={`pinned-urls-bar${isOver ? ' drop-target' : ''}`}
    >
      <SortableContext items={sorted.map((p) => p.id)} strategy={rectSortingStrategy}>
        {sorted.map((pin) => {
          const matchingTab = tabs.find((t) => urlsMatch(t.url, pin.url))
          return (
            <SortablePinnedTile
              key={pin.id}
              id={pin.id}
              pin={pin}
              accentColor={accentColor}
              isOpen={!!matchingTab}
              matchingTab={matchingTab}
            />
          )
        })}
      </SortableContext>
    </div>
  )
}