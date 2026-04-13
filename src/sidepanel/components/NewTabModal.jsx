import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

/**
 * Enhanced New Tab Modal with fuzzy tab search, history search,
 * URL/Google search fallback, and keyboard navigation.
 *
 * @param {{ isOpen: boolean, onClose: () => void, tabs: Array, accentColor: string }} props
 */
export default function NewTabModal({ isOpen, onClose, tabs = [], accentColor = '#8B7CF6' }) {
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [historyResults, setHistoryResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debounceTimer = useRef(null)

  // Auto-focus the input when the modal opens; reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setHistoryResults([])
      setSelectedIndex(0)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Fuse.js instance for fuzzy tab search
  const fuse = useMemo(() => new Fuse(tabs, {
    keys: ['title', 'url'],
    threshold: 0.4,
    includeScore: true,
  }), [tabs])

  // Debounced history search
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    if (query.length < 2) {
      setHistoryResults([])
      return
    }
    debounceTimer.current = setTimeout(() => {
      chrome.history.search({ text: query, maxResults: 5 }, (results) => {
        setHistoryResults(results || [])
      })
    }, 150)
    return () => clearTimeout(debounceTimer.current)
  }, [query])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  /**
   * Determine if the input looks like a URL.
   */
  const isUrlLike = (text) => {
    const t = text.trim()
    return t.includes('.') || t.startsWith('http://') || t.startsWith('https://') || t.startsWith('chrome://')
  }

  /**
   * Normalise a URL-like string to a full URL.
   */
  const toUrl = (text) => {
    const t = text.trim()
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t) && !t.startsWith('chrome://')) {
      return 'https://' + t
    }
    return t
  }

  // Build results list
  const results = useMemo(() => {
    const items = []

    if (!query.trim()) {
      // Show first 6 open tabs
      const shown = tabs.slice(0, 6)
      if (shown.length > 0) {
        items.push({ type: 'section', label: 'Open Tabs', key: 'section-open' })
        for (const tab of shown) {
          items.push({ type: 'tab', tab, key: `tab-${tab.id}` })
        }
      }
    } else {
      // Fuzzy search tabs
      const tabMatches = fuse.search(query).slice(0, 6)
      if (tabMatches.length > 0) {
        items.push({ type: 'section', label: 'Open Tabs', key: 'section-tabs' })
        for (const match of tabMatches) {
          items.push({ type: 'tab', tab: match.item, key: `tab-${match.item.id}` })
        }
      }

      // History results
      if (historyResults.length > 0) {
        items.push({ type: 'section', label: 'History', key: 'section-history' })
        for (const h of historyResults) {
          items.push({ type: 'history', url: h.url, title: h.title || h.url, key: `history-${h.url}` })
        }
      }

      // URL action
      if (isUrlLike(query)) {
        items.push({ type: 'url', url: toUrl(query), label: `Open: ${query.trim()}`, key: 'action-url' })
      }

      // Google search action
      items.push({
        type: 'search',
        url: `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`,
        label: `Search Google for "${query.trim()}"`,
        key: 'action-search',
      })
    }

    return items
  }, [query, tabs, fuse, historyResults])

  // Selectable items (exclude section headers)
  const selectableItems = useMemo(() => results.filter((r) => r.type !== 'section'), [results])

  const openItem = useCallback((item) => {
    if (!item) return
    if (item.type === 'tab') {
      chrome.tabs.update(item.tab.id, { active: true })
    } else {
      chrome.tabs.create({ url: item.url })
    }
    onClose()
  }, [onClose])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, selectableItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = selectableItems[selectedIndex]
      if (item) {
        openItem(item)
      } else if (query.trim()) {
        // Fallback: open as URL or search
        const url = isUrlLike(query)
          ? toUrl(query)
          : `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
        chrome.tabs.create({ url })
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!isOpen) return null

  // Map selectable items to their index for highlighting
  let selectableIdx = -1

  return (
    <div className="new-tab-modal-backdrop" onClick={handleBackdropClick}>
      <div className="new-tab-modal" style={{ '--accent': accentColor }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tabs or enter URL…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        {results.length > 0 && (
          <div className="new-tab-modal-results">
            {results.map((item) => {
              if (item.type === 'section') {
                return (
                  <div key={item.key} className="new-tab-result-section-label">
                    {item.label}
                  </div>
                )
              }

              selectableIdx++
              const idx = selectableIdx
              const isSelected = idx === selectedIndex

              if (item.type === 'tab') {
                const { tab } = item
                return (
                  <div
                    key={item.key}
                    className={`new-tab-result-item${isSelected ? ' selected' : ''}`}
                    onClick={() => openItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <TabFavicon tab={tab} />
                    <div className="result-text">
                      <div className="result-title">{tab.title || 'New Tab'}</div>
                      <div className="result-sub">{tab.url}</div>
                    </div>
                  </div>
                )
              }

              if (item.type === 'history') {
                return (
                  <div
                    key={item.key}
                    className={`new-tab-result-item${isSelected ? ' selected' : ''}`}
                    onClick={() => openItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="result-icon-fallback">📜</div>
                    <div className="result-text">
                      <div className="result-title">{item.title}</div>
                      <div className="result-sub">{item.url}</div>
                    </div>
                  </div>
                )
              }

              if (item.type === 'url') {
                return (
                  <div
                    key={item.key}
                    className={`new-tab-result-item${isSelected ? ' selected' : ''}`}
                    onClick={() => openItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="result-icon-fallback">🔗</div>
                    <div className="result-text">
                      <div className="result-title">{item.label}</div>
                    </div>
                  </div>
                )
              }

              if (item.type === 'search') {
                return (
                  <div
                    key={item.key}
                    className={`new-tab-result-item${isSelected ? ' selected' : ''}`}
                    onClick={() => openItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="result-icon-fallback">🔍</div>
                    <div className="result-text">
                      <div className="result-title">{item.label}</div>
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>
        )}

        <div className="new-tab-modal-footer">
          ↑↓ navigate &nbsp;·&nbsp; ↵ open &nbsp;·&nbsp; Esc close
        </div>
      </div>
    </div>
  )
}

/**
 * Favicon with fallback for a tab result item.
 */
function TabFavicon({ tab }) {
  const [imgError, setImgError] = React.useState(false)
  if (tab.favIconUrl && !imgError) {
    return (
      <img
        className="result-icon"
        src={tab.favIconUrl}
        alt=""
        onError={() => setImgError(true)}
      />
    )
  }
  const initial = (tab.title || tab.url || '?')[0].toUpperCase()
  return <div className="result-icon-fallback">{initial}</div>
}
