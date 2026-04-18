import React from 'react'
import useStore from '../store'
import { Messages } from '@shared/messages.js'

function openTabSwitcher() {
  chrome.runtime.sendMessage({
    type: Messages.TAB_SWITCHER_OPEN,
    screenWidth:  window.screen.width,
    screenHeight: window.screen.height,
  }).catch(() => {})
}

export default function BottomBar({ onNewTab, onNewSpace, onSessions, darkMode, onToggleDarkMode }) {
  const { activeSpaceId, suspendSpace } = useStore()

  const darkIcon  = darkMode === 'dark' ? '☀️' : darkMode === 'light' ? '🌙' : '🌗'
  const darkTitle = darkMode === 'dark' ? 'Light mode' : darkMode === 'light' ? 'Dark mode' : 'Auto (follows OS)'

  return (
    <div className="bottom-bar">
      {/* New Tab */}
      <button className="bottom-btn new-tab" onClick={onNewTab} title="New Tab (Ctrl+T)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New Tab
      </button>

      {/* Tab Switcher — Ctrl+Tab can't be intercepted by JS; this button is the reliable trigger */}
      <button className="bottom-btn" onClick={openTabSwitcher} title="Tab Switcher (Ctrl+Q)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="3" width="9" height="7" rx="1"/>
          <rect x="13" y="3" width="9" height="7" rx="1"/>
          <rect x="2" y="14" width="9" height="7" rx="1"/>
          <rect x="13" y="14" width="9" height="7" rx="1"/>
        </svg>
      </button>

      {/* New Space */}
      <button className="bottom-btn" onClick={onNewSpace} title="New Space">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </button>



      {/* Sessions */}
      <button className="bottom-btn" onClick={onSessions} title="Sessions">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>

      {/* Dark mode toggle */}
      <button className="bottom-btn" onClick={onToggleDarkMode} title={darkTitle} style={{ fontSize: 14 }}>
        {darkIcon}
      </button>
    </div>
  )
}