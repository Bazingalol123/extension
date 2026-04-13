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
import { urlsMatch } from '@shared/utils.js'

/**
 * Single pinned URL tile (non-sortable presentation).
 * Exported so App.jsx can render it inside the unified DragOverlay.
 */
export function PinnedTile({ pin, accentColor, isOpen, matchingTab, dragging }) {
  const { unpinUrl, activateTab, switchSpace, activeSpaceId } = useStore()

  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)

  const initial = (pin.title || pin.url || '?')[0].toUpperCase()
  const favIcon = pin.favIconUrl && !imgError ? pin.favIconUrl : null

  const handleClick = () => {
    if (isOpen && matchingTab) {
      // Tab is open — activate it, switch space if needed
      if (matchingTab.spaceId !== activeSpaceId) {
        switchSpace(matchingTab.spaceId)
      }
      activateTab(matchingTab.id)
    } else {
      // Closed — create new tab in current space
      chrome.tabs.create({ url: pin.url })
    }
  }

  const navigate = (newTab = false) => {
    if (newTab) {
      chrome.tabs.create({ url: pin.url })
    } else {
      handleClick()
    }
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
      className={`pinned-url-tile${isOpen ? ' is-open' : ' is-closed'}${dragging ? ' dragging' : ''}`}
      style={{ '--space-color': accentColor }}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        setCtxMenu({ x: rect.right, y: rect.top })
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
      }}
    >
      {favIcon ? (
        <img
          className="pinned-img"
          src={favIcon}
          alt=""
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="pinned-initial">{initial}</span>
      )}

      {isOpen && <div className="pinned-live-dot" />}

      {hovered && !ctxMenu && (
        <div className="pinned-tooltip">{pin.title || pin.url}</div>
      )}

      {ctxMenu && ReactDOM.createPortal(
        <div
          className="fav-ctx-menu"
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="ctx-item"
            onClick={() => {
              navigate(false)
              setCtxMenu(null)
            }}
          >
            Open
          </div>
          <div
            className="ctx-item"
            onClick={() => {
              navigate(true)
              setCtxMenu(null)
            }}
          >
            Open in New Tab
          </div>
          <div className="ctx-separator" />
          <div
            className="ctx-item danger"
            onClick={() => {
              unpinUrl(pin.id)
              setCtxMenu(null)
            }}
          >
            Remove Pin
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Sortable wrapper for pinned URL tiles.
 */
function SortablePinnedTile({ id, ...props }) {
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
      <PinnedTile {...props} />
    </div>
  )
}

/**
 * Bar of global pinned URLs, with drag-to-reorder.
 * Uses SortableContext inside the parent DndContext (lifted to App.jsx).
 * Also acts as a droppable zone so tabs can be dropped here to pin them.
 *
 * @param {Object} props
 * @param {Array} props.pins - Global pinned URLs array
 * @param {string} props.accentColor - Active space accent color
 * @param {Array} props.tabs - All tracked tabs (for open/closed state derivation)
 */
export default function PinnedUrlsBar({ pins, accentColor, tabs }) {
  const sorted = [...pins].sort((a, b) => a.order - b.order)

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'pinned-droppable' })

  if (pins.length === 0) return null

  return (
    <div
      ref={setDropRef}
      className={`pinned-urls-bar${isOver ? ' drop-target' : ''}`}
    >
      <SortableContext
        items={sorted.map((p) => p.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {sorted.map((pin) => {
            // Derive open/closed state: check if any tab matches this pin's URL
            const matchingTab = tabs.find((t) => urlsMatch(t.url, pin.url))
            const isOpen = !!matchingTab

            return (
              <SortablePinnedTile
                key={pin.id}
                id={pin.id}
                pin={pin}
                accentColor={accentColor}
                isOpen={isOpen}
                matchingTab={matchingTab}
              />
            )
          })}
        </div>
      </SortableContext>
    </div>
  )
}
