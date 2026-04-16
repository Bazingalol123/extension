import React, { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store'
import { getFaviconSrc, getFaviconFallback } from '@shared/utils.js'

/**
 * Individual tab row with favicon, title, close button, and context menu.
 * Right-click opens context menu.
 */
export default function TabItem({ tab, isActive, accentColor, spaces, folderId, spaceFolders, activeSpaceId, isDuplicate }) {
  const {
    activateTab, closeTab, moveTabToSpace, duplicateTab,
    muteTab, addFavorite, pinUrl, createFolder, moveTabToFolder,
    removeTabFromFolder, suspendTab,
  } = useStore()

  const [imgError, setImgError] = useState(false)
  const [ctxMenu, setCtxMenu]   = useState(null) // { x, y, showMove, showFolderMove }
  const ctxRef = useRef(null)

  const favicon  = getFaviconSrc(tab.favIconUrl)
  const fallback = getFaviconFallback(tab.title, tab.url)

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  // Reset img error when favicon changes
  useEffect(() => setImgError(false), [tab.favIconUrl])

  let hostname = ''
  try { hostname = new URL(tab.url).hostname.replace('www.', '') } catch {}

  const openCtx = (e) => {
    e.preventDefault()
    const MENU_W = 192
    const MENU_H = 300 // generous estimate including submenus
    const x = Math.min(e.clientX, window.innerWidth  - MENU_W - 8)
    const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8)
    setCtxMenu({ x, y, showMove: false, showFolderMove: false })
  }

  return (
    <>
      <div
        data-tab-id={tab.id}
        className={[
          'tab-item',
          isActive      ? 'active'         : '',
          tab.suspended ? 'suspended'       : '',
          isDuplicate   ? 'duplicate-flag'  : '',
        ].join(' ').trim()}
        style={{ '--space-color': accentColor }}
        onClick={() => activateTab(tab.id)}
        onContextMenu={openCtx}
        title={`${tab.title}\n${hostname}`}
      >
        <div className="tab-accent" />

        {/* Favicon */}
        {favicon && !imgError ? (
          <img className="tab-favicon" src={favicon} onError={() => setImgError(true)} alt="" />
        ) : (
          <span className="tab-favicon-fallback" style={{ background: fallback.color }}>
            {fallback.letter}
          </span>
        )}

        <span className="tab-title">{tab.title || hostname || 'New Tab'}</span>

        {/* Icons */}
        {tab.muted && (
          <svg className="tab-mute-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        )}
        {tab.pinned && (
          <svg className="tab-pin-icon" width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
          </svg>
        )}
        {tab.suspended && (
          <svg className="tab-suspend-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18.364 5.636a9 9 0 1 1-12.728 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
        )}

        <button
          className="tab-close"
          onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
          title="Close"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div ref={ctxRef} className="context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          {ctxMenu.showMove ? (
            <>
              <div className="context-item" onClick={() => setCtxMenu((m) => ({ ...m, showMove: false }))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </div>
              <div className="context-separator" />
              {spaces.filter((s) => s.id !== tab.spaceId).map((s) => (
                <div key={s.id} className="submenu-space-item"
                  onClick={() => { moveTabToSpace(tab.id, s.id); setCtxMenu(null) }}>
                  <span>{s.emoji}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 12.5 }}>{s.name}</span>
                </div>
              ))}
            </>
          ) : ctxMenu.showFolderMove ? (
            <>
              <div className="context-item" onClick={() => setCtxMenu((m) => ({ ...m, showFolderMove: false }))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </div>
              <div className="context-separator" />
              {spaceFolders.map((f) => (
                <div key={f.id} className="submenu-space-item"
                  onClick={() => { moveTabToFolder(tab.id, f.id); setCtxMenu(null) }}>
                  <span>📁</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 12.5 }}>{f.name}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="context-item" onClick={() => { duplicateTab(tab.id); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Duplicate <span className="ctx-shortcut">Ctrl+D</span>
              </div>
              <div className="context-item" onClick={() => { pinUrl(tab); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
                </svg>
                Pin to Sidebar
              </div>
              <div className="context-item" onClick={() => { addFavorite(tab); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Add to Favorites
              </div>
              <div className="context-item" onClick={() => { muteTab(tab.id); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {tab.muted ? (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                  ) : (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>
                  )}
                </svg>
                {tab.muted ? 'Unmute' : 'Mute'} Tab
              </div>
              <div className="context-item" onClick={() => { suspendTab(tab.id); setCtxMenu(null) }}
                title="Unload from memory. Reloads on click.">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18.364 5.636a9 9 0 1 1-12.728 0"/>
                  <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                {tab.suspended ? 'Already Suspended' : 'Suspend Tab'}
              </div>

              {spaces.length > 1 && (
                <div className="context-item" onClick={() => setCtxMenu((m) => ({ ...m, showMove: true }))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  Move to Space ›
                </div>
              )}

              <div className="context-separator" />

              <div className="context-item" onClick={() => { createFolder(activeSpaceId || tab.spaceId, 'New Folder', [tab.id]); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Create Folder
              </div>

              {spaceFolders && spaceFolders.length > 0 && (
                <div className="context-item" onClick={() => setCtxMenu((m) => ({ ...m, showFolderMove: true }))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  Move to Folder ›
                </div>
              )}

              {folderId && (
                <div className="context-item" onClick={() => { removeTabFromFolder(tab.id); setCtxMenu(null) }}>
                  Remove from Folder
                </div>
              )}

              <div className="context-separator" />

              <div className="context-item danger" onClick={() => { closeTab(tab.id); setCtxMenu(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
 * Drag-sortable wrapper around TabItem.
 */
export function SortableTabItem({ id, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      data-tab-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      {...attributes}
      {...listeners}
    >
      <TabItem {...props} />
    </div>
  )
}