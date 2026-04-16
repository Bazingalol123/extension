import React, { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTabItem } from './TabItem'
import useStore from '../store'

/**
 * Collapsible folder containing tab items.
 * Can be renamed inline and has a context menu for rename/delete.
 */
export default function FolderItem({
  folder, tabs, activeTabId, accentColor, spaces, activeSpaceId, duplicateUrls = new Set(),
}) {
  const { toggleFolder, renameFolder, deleteFolder, removeTabFromFolder } = useStore()

  const [ctxMenu, setCtxMenu]     = useState(null)
  const [renaming, setRenaming]   = useState(false)
  const [nameValue, setNameValue] = useState(folder.name)
  const ctxRef   = useRef(null)
  const inputRef = useRef(null)

  const folderTabs = folder.tabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter(Boolean)

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `folder-${folder.id}` })

  useEffect(() => {
    if (!ctxMenu) return
    const h = (e) => { if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.focus(), 50)
  }, [renaming])

  const handleRename = () => {
    if (nameValue.trim()) renameFolder(folder.id, nameValue.trim())
    setRenaming(false)
  }

  return (
    <div
      className={`folder-item${isOver ? ' drop-target' : ''}`}
      ref={setDropRef}
    >
      {/* Folder header */}
      <div
        className="folder-header"
        onClick={() => { if (!renaming) toggleFolder(folder.id) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 120) })
        }}
      >
        <span className={`chevron${!folder.collapsed ? ' expanded' : ''}`}>▶</span>
        <span className="folder-icon">📁</span>

        {renaming ? (
          <input
            ref={inputRef}
            className="folder-name-input"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            onBlur={handleRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="folder-name">{folder.name}</span>
        )}

        <span className="folder-count">{folderTabs.length}</span>
      </div>

      {/* Folder children */}
      {!folder.collapsed && folderTabs.length > 0 && (
        <div className={`folder-children${folder.collapsed ? ' collapsed' : ''}`}>
          <SortableContext
            items={folderTabs.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {folderTabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                id={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                accentColor={accentColor}
                spaces={spaces}
                folderId={folder.id}
                spaceFolders={[]}
                activeSpaceId={activeSpaceId}
                isDuplicate={duplicateUrls.has(tab.url)}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div ref={ctxRef} className="folder-context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <button onClick={() => { setRenaming(true); setCtxMenu(null) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Rename
          </button>
          <button className="danger" onClick={() => { deleteFolder(folder.id); setCtxMenu(null) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Delete Folder
          </button>
        </div>
      )}
    </div>
  )
}