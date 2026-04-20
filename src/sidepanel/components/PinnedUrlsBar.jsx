import React, { useState } from 'react'
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback } from '@shared/utils.js'

/**
 * Individual pinned tile — ownership-based active state.
 * Inactive: pin has no owned tab in this window → click opens + binds
 * Active:   pin owns a tab → click activates, [-] closes
 * Drifted:  owned tab's URL differs from pin's URL → orange dot, click disabled, [↻] reset
 */
export function PinnedTile({ pin, accentColor, dragging }) {
  const {
    unpinUrl, setPinUrlToCurrent,
    activatePin, deactivatePin, resetPinDrift,
    pinOwnerships, myWindowId,
  } = useStore()
  const [imgError, setImgError] = useState(false)
  const [hover, setHover]       = useState(false)
  const [ctxMenu, setCtxMenu]   = useState(null)
  const ctxRef = React.useRef(null)

  const ownership = (pinOwnerships || []).find(o => o.pinId === pin.id && o.windowId === myWindowId)
  const isActive  = !!ownership
  const isDrifted = !!ownership?.drifted

  const favicon  = getFaviconSrc(pin.favIconUrl)
  const fallback = getFaviconFallback(pin.title, pin.url)

  React.useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  const handleClick = () => {
    if (isDrifted) return
    activatePin(pin.id)
  }

  return (
    <>
      <div
        className={`pinned-url-tile${isActive ? ' is-active' : ' is-closed'}${isDrifted ? ' is-drifted' : ''}`}
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
        {isActive && !isDrifted && <span className="pinned-live-dot" />}
        {isActive && hover && !dragging && !isDrifted && (
          <button
            className="pin-action-btn pin-close-btn"
            onClick={(e) => { e.stopPropagation(); deactivatePin(pin.id) }}
            title="Close tab (keep pin)"
          >−</button>
        )}
        {isDrifted && hover && !dragging && (
          <button
            className="pin-action-btn pin-reset-btn"
            onClick={(e) => { e.stopPropagation(); resetPinDrift(pin.id) }}
            title="Reset to original URL"
          >↻</button>
        )}
        {hover && !dragging && (
          <span className="pinned-tooltip">{pin.title || pin.url}</span>
        )}
      </div>
      {ctxMenu && (
        <div ref={ctxRef} className="fav-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="ctx-item" onClick={() => { activatePin(pin.id); setCtxMenu(null) }}>
            {isActive ? 'Switch to Tab' : 'Open'}
          </div>
          <div className="ctx-item" onClick={() => { chrome.tabs.create({ url: pin.url }); setCtxMenu(null) }}>
            Open New Tab
          </div>
          {isDrifted && (
            <>
              <div className="ctx-separator" />
              <div className="ctx-item" onClick={() => { setPinUrlToCurrent(pin.id); setCtxMenu(null) }}>
                Set URL to current tab
              </div>
              <div className="ctx-item" onClick={() => { resetPinDrift(pin.id); setCtxMenu(null) }}>
                Reset to original URL
              </div>
            </>
          )}
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

export default function PinnedUrlsBar({ pins, accentColor }) {
  const sorted = [...pins].sort((a, b) => a.order - b.order)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'pinned-droppable' })

  if (sorted.length === 0) return null

  return (
    <div
      ref={setDropRef}
      className={`pinned-urls-bar${isOver ? ' drop-target' : ''}`}
    >
      <SortableContext items={sorted.map((p) => p.id)} strategy={rectSortingStrategy}>
        {sorted.map((pin) => (
          <SortablePinnedTile
            key={pin.id}
            id={pin.id}
            pin={pin}
            accentColor={accentColor}
          />
        ))}
      </SortableContext>
    </div>
  )
}