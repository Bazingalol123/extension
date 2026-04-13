import React, { useState, useEffect, useRef } from 'react'

/**
 * Bottom toolbar with a "+" mini-menu (New Tab / New Space / New Folder),
 * History, Downloads, and Settings buttons.
 *
 * @param {{ onNewTab?: () => void, onNewSpace?: () => void, onNewFolder?: () => void }} props
 */
export default function BottomBar({ onNewTab, onNewSpace, onNewFolder }) {
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const wrapperRef = useRef(null)

  // Close the plus menu when clicking outside
  useEffect(() => {
    if (!showPlusMenu) return
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowPlusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPlusMenu])

  const handleSettings = () => {
    chrome.runtime?.openOptionsPage?.() ??
      chrome.tabs.create({ url: 'chrome://extensions/' })
  }

  return (
    <div className="bottom-bar">
      {/* Plus mini-menu wrapper */}
      <div className="plus-menu-wrapper" ref={wrapperRef}>
        {showPlusMenu && (
          <div className="plus-menu">
            <button
              className="plus-menu-item"
              onClick={() => {
                if (onNewTab) onNewTab()
                else chrome.tabs.create({})
                setShowPlusMenu(false)
              }}
            >
              <span>⊕</span> New Tab
            </button>
            <button
              className="plus-menu-item"
              onClick={() => {
                if (onNewSpace) onNewSpace()
                setShowPlusMenu(false)
              }}
            >
              <span>◈</span> New Space
            </button>
            <button
              className="plus-menu-item"
              onClick={() => {
                if (onNewFolder) onNewFolder()
                setShowPlusMenu(false)
              }}
            >
              <span>📁</span> New Folder
            </button>
          </div>
        )}

        <button
          className="bottom-btn new-tab"
          onClick={() => setShowPlusMenu((v) => !v)}
          title="New Tab / Space / Folder"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* History */}
      <button
        className="bottom-btn"
        onClick={() => chrome.tabs.create({ url: 'chrome://history/' })}
        title="History"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.44" />
        </svg>
      </button>

      {/* Downloads */}
      <button
        className="bottom-btn"
        onClick={() => chrome.tabs.create({ url: 'chrome://downloads/' })}
        title="Downloads"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {/* Settings */}
      <button className="bottom-btn" onClick={handleSettings} title="Settings">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
