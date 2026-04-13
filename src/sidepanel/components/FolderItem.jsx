import React, { useState, useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import useStore from '../store'

/**
 * Collapsible folder component that groups tabs.
 *
 * Visual structure:
 *   ▸ 📁 Folder Name (3)    ← collapsed
 *   ▾ 📁 Folder Name (3)    ← expanded
 *       🌐 Tab 1 Title        ← indented tabs
 *       🌐 Tab 2 Title
 */
export default function FolderItem({ folder, tabs, activeTabId, accentColor, spaces, activeSpaceId }) {
  const {
    toggleFolder,
    renameFolder,
    deleteFolder,
    activateTab,
    closeTab,
    createFolder,
    moveTabToFolder,
    removeTabFromFolder,
  } = useStore()

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [ctxMenu, setCtxMenu] = useState(null)
  const ctxRef = useRef(null)
  const inputRef = useRef(null)

  // Droppable zone for this folder
  const { isOver, setNodeRef } = useDroppable({
    id: 'folder-' + folder.id,
  })

  // Resolve folder's tabs from the full tab list
  const folderTabs = folder.tabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter(Boolean)

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

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSaveRename = () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== folder.name) {
      renameFolder(folder.id, trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveRename()
    } else if (e.key === 'Escape') {
      setEditName(folder.name)
      setEditing(false)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={`folder-item${isOver ? ' drop-target' : ''}`}
      >
        {/* Folder Header */}
        <div
          className="folder-header"
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setCtxMenu({ x: e.clientX, y: e.clientY })
          }}
        >
          <span className={`chevron${folder.collapsed ? '' : ' expanded'}`}>▸</span>
          <span className="folder-icon">📁</span>

          {editing ? (
            <input
              ref={inputRef}
              className="folder-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="folder-name"
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditName(folder.name)
                setEditing(true)
              }}
            >
              {folder.name}
            </span>
          )}

          <span className="folder-count">({folderTabs.length})</span>
        </div>

        {/* Folder Children */}
        <div className={`folder-children${folder.collapsed ? ' collapsed' : ''}`}>
          {folderTabs.map((tab) => (
            <FolderTabRow
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              accentColor={accentColor}
              onActivate={() => activateTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="folder-context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            onClick={() => {
              setEditName(folder.name)
              setEditing(true)
              setCtxMenu(null)
            }}
          >
            ✏️ Rename Folder
          </button>
          <button
            onClick={() => {
              toggleFolder(folder.id)
              setCtxMenu(null)
            }}
          >
            {folder.collapsed ? '📂 Expand' : '📁 Collapse'}
          </button>
          <button
            onClick={() => {
              deleteFolder(folder.id)
              setCtxMenu(null)
            }}
            style={{ color: '#f87171' }}
          >
            🗑️ Delete Folder
          </button>
        </div>
      )}
    </>
  )
}

/**
 * A simplified tab row rendered inside a folder.
 * Shows favicon + title + close button, indented.
 */
function FolderTabRow({ tab, isActive, accentColor, onActivate, onClose }) {
  const [imgError, setImgError] = useState(false)
  const favIconUrl = tab.favIconUrl && !imgError ? tab.favIconUrl : null
  const initial = (tab.title || tab.url || '?')[0].toUpperCase()

  return (
    <div
      className={`tab-item${isActive ? ' active' : ''}`}
      style={{ '--space-color': accentColor }}
      onClick={onActivate}
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
        {tab.title || 'New Tab'}
      </span>

      <button
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
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
  )
}
