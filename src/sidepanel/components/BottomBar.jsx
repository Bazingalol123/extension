import React, { useState, useRef, useEffect } from 'react'
import { Messages } from '@shared/messages.js'
import useStore from '../store'

const openTabSwitcher = () => {
  chrome.runtime.sendMessage({
    type: Messages.TAB_SWITCHER_OPEN,
    screenWidth:  window.screen.width,
    screenHeight: window.screen.height,
  }).catch(() => {})
}

/**
 * Icon-only bottom bar with a + dropdown for quick add actions.
 *
 * Props match the previous BottomBar so App.jsx can stay unchanged:
 *   onNewTab, onNewSpace, onSessions, darkMode, onToggleDarkMode
 *
 * The + button opens a small menu: New tab / New space / New folder.
 * "New folder" creates a folder at the root of favorites.
 */
export default function BottomBar({ onNewTab, onNewSpace, onSessions, darkMode, onToggleDarkMode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)
  const { createFavoriteFolder, favoritesRootId } = useStore()

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleNewFolder = () => {
    createFavoriteFolder('New folder', favoritesRootId)
    setMenuOpen(false)
  }

  const darkTitle =
    darkMode === 'light' ? 'Light mode (click for dark)'
    : darkMode === 'dark' ? 'Dark mode (click for auto)'
    : 'Auto mode (click for light)'
  const darkIcon =
    darkMode === 'light' ? '☀'
    : darkMode === 'dark' ? '☾'
    : '◐'

  return (
    <div className="bottom-bar">
      {/* + menu */}
      <div className="bottom-plus-wrap" ref={wrapRef}>
        <button
          className="bottom-btn"
          onClick={() => setMenuOpen(o => !o)}
          title="Add…"
          aria-expanded={menuOpen}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        {menuOpen && (
          <div className="bottom-plus-menu" role="menu">
            <button role="menuitem" onClick={() => { onNewTab(); setMenuOpen(false) }}>
              <span className="bottom-plus-menu-label">New tab</span>
              <span className="bottom-plus-menu-kbd">Ctrl+T</span>
            </button>
            <button role="menuitem" onClick={() => { onNewSpace(); setMenuOpen(false) }}>
              <span className="bottom-plus-menu-label">New space</span>
            </button>
            <button role="menuitem" onClick={handleNewFolder}>
              <span className="bottom-plus-menu-label">New folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <button className="bottom-btn" onClick={openTabSwitcher} title="Tab Switcher (Ctrl+Q)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>

      {/* Sessions */}
      <button className="bottom-btn" onClick={onSessions} title="Sessions">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 8v13H3V8"/>
          <path d="M1 3h22v5H1z"/>
          <path d="M10 12h4"/>
        </svg>
      </button>

      {/* Dark mode toggle */}
      <button className="bottom-btn bottom-btn-theme" onClick={onToggleDarkMode} title={darkTitle}>
        {darkIcon}
      </button>
    </div>
  )
}