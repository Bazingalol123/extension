import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Fuse from 'fuse.js'
import ResultItem, { getFaviconUrl, getDomain } from './ResultItem.jsx'

/**
 * Check if a string looks like a URL.
 * @param {string} str
 * @returns {boolean}
 */
function isUrl(str) {
  return /^https?:\/\//i.test(str) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(str)
}

/**
 * CommandBar — Spotlight-style overlay for searching tabs, history, and navigating.
 *
 * @param {{ accentColor: string, onClose: () => void }} props
 */
const CommandBar = ({ accentColor, onClose }) => {
  const [query, setQuery] = useState('')
  const [tabs, setTabs] = useState([])
  const [historyItems, setHistoryItems] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  /* ── Fetch all tabs on mount ── */
  useEffect(() => {
    chrome.tabs.query({}).then((allTabs) => {
      setTabs(
        allTabs
          .filter((t) => t.id && t.url && !t.url.startsWith('chrome://'))
          .map((t) => ({
            kind: 'tab',
            id: t.id,
            title: t.title || getDomain(t.url || ''),
            url: t.url || '',
            favIconUrl: t.favIconUrl || getFaviconUrl(t.url || ''),
          }))
      )
    })
  }, [])

  /* ── Debounced history search (150ms, ≥ 2 chars) ── */
  useEffect(() => {
    if (!query || query.length < 2) {
      setHistoryItems([])
      return
    }

    const timer = setTimeout(() => {
      chrome.history
        .search({ text: query, maxResults: 8, startTime: 0 })
        .then((results) => {
          const tabUrls = new Set(tabs.map((t) => t.url))
          setHistoryItems(
            results
              .filter((h) => h.url && !tabUrls.has(h.url) && !h.url.startsWith('chrome://'))
              .slice(0, 6)
              .map((h) => ({
                kind: 'history',
                title: h.title || getDomain(h.url),
                url: h.url,
              }))
          )
        })
        .catch(() => {})
    }, 150)

    return () => clearTimeout(timer)
  }, [query, tabs])

  /* ── Fuse.js fuzzy search on tabs ── */
  const fuse = useMemo(
    () => new Fuse(tabs, { keys: ['title', 'url'], threshold: 0.4, includeScore: true }),
    [tabs]
  )

  const matchedTabs = useMemo(
    () => (query ? fuse.search(query).slice(0, 7).map((r) => r.item) : tabs.slice(0, 7)),
    [query, fuse, tabs]
  )

  /* ── Action results (URL / Search / New Tab) ── */
  const actions = useMemo(() => {
    const items = []

    if (query) {
      if (isUrl(query)) {
        const url = /^https?:\/\//i.test(query) ? query : `https://${query}`
        items.push({
          kind: 'action',
          icon: 'url',
          label: `Open ${query}`,
          subtitle: 'Navigate to URL',
          action: () => chrome.tabs.create({ url }),
        })
      }

      items.push({
        kind: 'action',
        icon: 'search',
        label: `Search for "${query}"`,
        subtitle: 'Google Search',
        action: () =>
          chrome.tabs.create({
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          }),
      })
    } else {
      items.push({
        kind: 'action',
        icon: 'new',
        label: 'New Tab',
        subtitle: 'Open a blank tab',
        action: () => chrome.tabs.create({}),
      })
    }

    return items
  }, [query])

  /* ── Combined results: tabs → history → actions ── */
  const allResults = useMemo(
    () => [...matchedTabs, ...historyItems, ...actions],
    [matchedTabs, historyItems, actions]
  )

  /* ── Reset selection when query changes ── */
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  /* ── Select a result ── */
  const selectResult = useCallback(
    (item) => {
      if (item.kind === 'tab') {
        chrome.tabs.update(item.id, { active: true })
      } else if (item.kind === 'history') {
        chrome.tabs.create({ url: item.url })
      } else {
        item.action()
      }
      onClose()
    },
    [onClose]
  )

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback(
    (evt) => {
      if (evt.key === 'Escape') {
        onClose()
        return
      }

      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1))
      }

      if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }

      if (evt.key === 'Enter' && allResults[selectedIndex]) {
        evt.preventDefault()
        selectResult(allResults[selectedIndex])
      }
    },
    [allResults, selectedIndex, selectResult, onClose]
  )

  /* ── Scroll active item into view ── */
  useEffect(() => {
    const el = resultsRef.current?.querySelector(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  /* ── Auto-focus input ── */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /* ── Render result items with a running index counter ── */
  let runningIndex = 0

  const renderTab = (item) => {
    const idx = runningIndex++
    return (
      <ResultItem
        key={`tab-${item.id}`}
        item={item}
        active={idx === selectedIndex}
        index={idx}
        onClick={() => selectResult(item)}
        onMouseEnter={() => setSelectedIndex(idx)}
      />
    )
  }

  const renderHistory = (item) => {
    const idx = runningIndex++
    return (
      <ResultItem
        key={`hist-${item.url}`}
        item={item}
        active={idx === selectedIndex}
        index={idx}
        onClick={() => selectResult(item)}
        onMouseEnter={() => setSelectedIndex(idx)}
      />
    )
  }

  const renderAction = (item) => {
    const idx = runningIndex++
    return (
      <ResultItem
        key={`act-${item.label}`}
        item={item}
        active={idx === selectedIndex}
        index={idx}
        onClick={() => selectResult(item)}
        onMouseEnter={() => setSelectedIndex(idx)}
      />
    )
  }

  return (
    <>
      {/* Backdrop — click to close */}
      <div className="backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="modal" style={{ '--accent': accentColor }}>
        {/* Search row */}
        <div className="search-row">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search tabs, history, or type a URL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />

          <span className="kbd-hint">ESC</span>
        </div>

        {/* Results */}
        <div className="results" ref={resultsRef}>
          {allResults.length === 0 ? (
            <div className="empty-state">No results</div>
          ) : (
            <>
              {matchedTabs.length > 0 && (
                <>
                  <div className="section-label">
                    {query ? 'Open Tabs' : 'All Tabs'}
                  </div>
                  {matchedTabs.map(renderTab)}
                </>
              )}

              {historyItems.length > 0 && (
                <>
                  {matchedTabs.length > 0 && <div className="divider" />}
                  <div className="section-label">History</div>
                  {historyItems.map(renderHistory)}
                </>
              )}

              {actions.length > 0 && (
                <>
                  {(matchedTabs.length > 0 || historyItems.length > 0) && (
                    <div className="divider" />
                  )}
                  {actions.map(renderAction)}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="footer">
          <span className="footer-hint">
            <span className="footer-key">↑↓</span> navigate
          </span>
          <span className="footer-hint">
            <span className="footer-key">↵</span> open
          </span>
          <span className="footer-hint">
            <span className="footer-key">Ctrl+Space</span> toggle
          </span>
        </div>
      </div>
    </>
  )
}

export default CommandBar
