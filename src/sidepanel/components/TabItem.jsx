import React, { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'

/**
 * Individual tab row with favicon, title, close button, and context menu.
 * Right-click opens context menu with pin/unpin, favorites, move, mute, duplicate, close,
 * and folder management options.
 */
export default function TabItem({ tab, isActive, accentColor, spaces, folderId, spaceFolders, activeSpaceId }) {
  const {
    activateTab,
    closeTab,
    moveTabToSpace,
    duplicateTab,
    muteTab,
    addFavorite,
    pinUrl,
    createFolder,
    moveTabToFolder,
    removeTabFromFolder,
  } = useStore()

  const [imgError, setImgError] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const ctxRef = useRef(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handleClickOutside = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ctxMenu])

  const favIconUrl = tab.favIconUrl && !imgError ? tab.favIconUrl : null
  const initial = (tab.title || tab.url || '?')[0].toUpperCase()

  let hostname = ''
  try {
    hostname = new URL(tab.url).hostname.replace('www.', '')
  } catch {}

  return (
    <>
      <div
        className={`tab-item${isActive ? ' active' : ''}`}
        style={{ '--space-color': accentColor }}
        onClick={() => activateTab(tab.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          const MENU_WIDTH = 180;
          const MENU_HEIGHT = 250;
          const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8);
          const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8);
          setCtxMenu({ x, y, showMove: false, showFolderMove: false })
        }}
        title={tab.title}
      >
        <div className="tab-accent" />

        {favIconUrl ? (
          <img
            className="tab-favicon"
            src={favIconUrl}
            alt=""
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="tab-favicon-fallback">{initial}</div>
        )}

        <span className="tab-title">
          {tab.title || hostname || 'New Tab'}
        </span>

        {tab.muted && (
          <svg
            className="tab-mute-icon"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          </svg>
        )}

        <button
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation()
            closeTab(tab.id)
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path
              d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {ctxMenu.showMove ? (
            <>
              <div
                className="context-item"
                style={{ color: 'var(--text-secondary)', fontSize: 11 }}
                onClick={() => setCtxMenu((m) => (m ? { ...m, showMove: false } : null))}
              >
                ‹ Back
              </div>
              <div className="context-separator" />
              {spaces
                .filter((s) => s.id !== tab.spaceId)
                .map((s) => (
                  <div
                    key={s.id}
                    className="submenu-space-item"
                    onClick={() => {
                      moveTabToSpace(tab.id, s.id)
                      setCtxMenu(null)
                    }}
                  >
                    <span>{s.emoji}</span>
                    <span>{s.name}</span>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.color,
                        marginLeft: 'auto',
                      }}
                    />
                  </div>
                ))}
            </>
          ) : ctxMenu.showFolderMove ? (
            <>
              <div
                className="context-item"
                style={{ color: 'var(--text-secondary)', fontSize: 11 }}
                onClick={() => setCtxMenu((m) => (m ? { ...m, showFolderMove: false } : null))}
              >
                ‹ Back
              </div>
              <div className="context-separator" />
              {(spaceFolders || [])
                .filter((f) => f.id !== folderId)
                .map((f) => (
                  <div
                    key={f.id}
                    className="submenu-space-item"
                    onClick={() => {
                      moveTabToFolder(tab.id, f.id)
                      setCtxMenu(null)
                    }}
                  >
                    <span>📁</span>
                    <span>{f.name}</span>
                  </div>
                ))}
            </>
          ) : (
            <>
              {/* Switch to Tab */}
              <div
                className="context-item"
                onClick={() => {
                  activateTab(tab.id)
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
                Switch to Tab
              </div>

              {/* Duplicate */}
              <div
                className="context-item"
                onClick={() => {
                  duplicateTab(tab.id)
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
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Duplicate <span className="ctx-shortcut">Ctrl+D</span>
              </div>

              {/* Pin to Sidebar */}
              <div
                className="context-item"
                onClick={() => {
                  pinUrl(tab)
                  setCtxMenu(null)
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
                </svg>
                Pin to Sidebar
              </div>

              {/* Add to Favorites */}
              <div
                className="context-item"
                onClick={() => {
                  addFavorite(tab)
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
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Add to Favorites bar
              </div>

              {/* Mute/Unmute */}
              <div
                className="context-item"
                onClick={() => {
                  muteTab(tab.id)
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
                  {tab.muted ? (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </>
                  ) : (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </>
                  )}
                </svg>
                {tab.muted ? 'Unmute' : 'Mute'} Tab
              </div>

              {/* Move to Space */}
              {spaces.length > 1 && (
                <div
                  className="context-item"
                  onClick={() =>
                    setCtxMenu((m) => (m ? { ...m, showMove: true } : null))
                  }
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
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  Move to Space ›
                </div>
              )}

              <div className="context-separator" />

              {/* Create Folder */}
              <div
                className="context-item"
                onClick={() => {
                  createFolder(activeSpaceId || tab.spaceId, 'New Folder', [tab.id])
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
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Create Folder
              </div>

              {/* Move to Folder */}
              {spaceFolders && spaceFolders.length > 0 && (
                <div
                  className="context-item"
                  onClick={() =>
                    setCtxMenu((m) => (m ? { ...m, showFolderMove: true } : null))
                  }
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
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  Move to Folder ›
                </div>
              )}

              {/* Remove from Folder */}
              {folderId && (
                <div
                  className="context-item"
                  onClick={() => {
                    removeTabFromFolder(tab.id)
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
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Remove from Folder
                </div>
              )}

              <div className="context-separator" />

              {/* Close Tab */}
              <div
                className="context-item danger"
                onClick={() => {
                  closeTab(tab.id)
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close Tab
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Sortable wrapper for TabItem — used inside DndContext / SortableContext.
 * Follows the same pattern as SortableFavTile in FavoritesBar.jsx.
 */
export function SortableTabItem({ id, ...props }) {
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
      <TabItem {...props} />
    </div>
  )
}
