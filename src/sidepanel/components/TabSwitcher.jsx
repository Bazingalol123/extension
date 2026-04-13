import React, { useEffect, useState, useRef, useCallback } from 'react'

/**
 * TabSwitcher — Ctrl+Tab modal overlay showing the 5 most recently used tabs.
 *
 * Mimics the VS Code / macOS Cmd+Tab switcher:
 *   - Ctrl+Tab cycles forward through MRU tabs
 *   - Ctrl+Shift+Tab cycles backward
 *   - Releasing Ctrl activates the selected tab
 *   - Enter also activates, Escape cancels
 *
 * @param {{ isOpen: boolean, onClose: () => void, tabs: Array, tabAccessOrder: number[], activeSpaceId: string, spaces: Array }} props
 */
export default function TabSwitcher({ isOpen, onClose, tabs, tabAccessOrder, activeSpaceId, spaces }) {
  const [selectedIndex, setSelectedIndex] = useState(1)
  const ctrlHeld = useRef(false)

  // Resolve tabAccessOrder IDs to actual tab objects, limit to 5
  const mruTabs = React.useMemo(() => {
    const resolved = []
    for (const id of tabAccessOrder) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) resolved.push(tab)
      if (resolved.length >= 5) break
    }
    return resolved
  }, [tabAccessOrder, tabs])

  // Reset selection when opened
  useEffect(() => {
    if (isOpen) {
      // Start at index 1 (previous tab) unless only 1 tab
      setSelectedIndex(mruTabs.length > 1 ? 1 : 0)
      ctrlHeld.current = true
    }
  }, [isOpen, mruTabs.length])

  const activateSelected = useCallback(() => {
    const tab = mruTabs[selectedIndex]
    if (tab) {
      // If tab is in a different space, the background will handle the space switch
      // via onActivated listener
      chrome.tabs.update(tab.id, { active: true }).catch(() => {})
    }
    onClose()
  }, [mruTabs, selectedIndex, onClose])

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      const count = mruTabs.length
      if (count === 0) return

      if (e.key === 'Tab' && e.ctrlKey && !e.shiftKey) {
        // Ctrl+Tab → move selection down
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % count)
      } else if (e.key === 'Tab' && e.ctrlKey && e.shiftKey) {
        // Ctrl+Shift+Tab → move selection up
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev - 1 + count) % count)
      } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey)) {
        // Arrow Down or Tab → move down
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % count)
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && !e.ctrlKey && e.shiftKey)) {
        // Arrow Up or Shift+Tab → move up
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev - 1 + count) % count)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        activateSelected()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    const handleKeyUp = (e) => {
      // Ctrl release → activate selected tab (hold Ctrl, tap Tab, release pattern)
      if (e.key === 'Control' && ctrlHeld.current) {
        ctrlHeld.current = false
        activateSelected()
      }
    }

    // Use capture phase so we intercept before other listeners
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', handleKeyUp, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isOpen, mruTabs, activateSelected, onClose])

  if (!isOpen || mruTabs.length === 0) return null

  return (
    <div className="tab-switcher-backdrop" onClick={onClose}>
      <div className="tab-switcher" onClick={(e) => e.stopPropagation()}>
        <div className="tab-switcher-header">⌨️ Switch Tab</div>

        {mruTabs.map((tab, index) => {
          const isSelected = index === selectedIndex
          const inDifferentSpace = tab.spaceId !== activeSpaceId
          const space = inDifferentSpace ? spaces.find((s) => s.id === tab.spaceId) : null

          return (
            <div
              key={tab.id}
              className={`tab-switcher-item${isSelected ? ' selected' : ''}`}
              onClick={() => {
                setSelectedIndex(index)
                const t = mruTabs[index]
                if (t) {
                  chrome.tabs.update(t.id, { active: true }).catch(() => {})
                }
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <TabFavicon tab={tab} />
              <span className="tab-title">{tab.title || 'New Tab'}</span>
              {space && <span className="space-badge">{space.emoji}</span>}
            </div>
          )
        })}

        <div className="tab-switcher-footer">
          Tab ↕ navigate · Enter ⏎ select · Esc cancel
        </div>
      </div>
    </div>
  )
}

/**
 * Renders a favicon image with a letter fallback.
 * @param {{ tab: { favIconUrl?: string, title?: string } }} props
 */
function TabFavicon({ tab }) {
  const [imgError, setImgError] = React.useState(false)

  if (tab.favIconUrl && !imgError) {
    return (
      <img
        className="favicon"
        src={tab.favIconUrl}
        width={18}
        height={18}
        onError={() => setImgError(true)}
        alt=""
      />
    )
  }

  const letter = (tab.title || '?')[0].toUpperCase()
  return (
    <span
      className="favicon"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 4,
        background: '#00000014',
        fontSize: 10,
        fontWeight: 700,
        color: '#888',
      }}
    >
      {letter}
    </span>
  )
}
