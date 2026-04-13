import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

/* ── Helper functions ── */

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function isUrl(str) {
  return /^https?:\/\//i.test(str) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(str)
}

function getFaviconUrl(url) {
  try {
    return `${new URL(url).origin}/favicon.ico`
  } catch {
    return ''
  }
}

/* ── Favicon component ── */

const Favicon = ({ src, title, size = 20 }) => {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 5,
          background: 'rgba(124,106,247,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.45,
          fontWeight: 700,
          color: '#7C6AF7',
          flexShrink: 0,
        }}
      >
        {(title || '?')[0].toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setErrored(true)}
    />
  )
}

/* ── Search icon (magnifying glass) ── */
const SearchIcon = ({ stroke = '#7C6AF7', size = 18, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="2.5"
    strokeLinecap="round"
    style={style}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

/* ── Kind icon for action results ── */
const KindIcon = (kind) => {
  if (kind === 'search') {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          background: 'rgba(124,106,247,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SearchIcon stroke="#7C6AF7" size={11} />
      </div>
    )
  }

  if (kind === 'url') {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          background: 'rgba(52,211,153,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34D399"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    )
  }

  return null
}

/* ── Main NewTab component ── */

const NewTab = () => {
  const [query, setQuery] = useState('')
  const [tabs, setTabs] = useState([])
  const [historyResults, setHistoryResults] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [accentColor, setAccentColor] = useState('#7C6AF7')
  const [greeting, setGreeting] = useState('')

  const inputRef = useRef(null)
  const listRef = useRef(null)

  /* Greeting based on time of day */
  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    )
  }, [])

  /* Load accent color from active space */
  useEffect(() => {
    chrome.storage.local.get('arcState', (data) => {
      const state = data.arcState
      if (state?.spaces && state.activeSpaceId) {
        const space = state.spaces.find((s) => s.id === state.activeSpaceId)
        if (space?.color) {
          setAccentColor(space.color)
        }
      }
    })
  }, [])

  /* Load open tabs on mount */
  useEffect(() => {
    chrome.tabs.query({}).then((allTabs) => {
      setTabs(
        allTabs
          .filter(
            (t) =>
              t.id &&
              t.url &&
              !t.url.startsWith('chrome-extension://') &&
              !t.url.startsWith('chrome://newtab')
          )
          .map((t) => ({
            id: t.id,
            title: t.title || getDomain(t.url || ''),
            url: t.url || '',
            favIconUrl: t.favIconUrl || getFaviconUrl(t.url || ''),
          }))
      )
    })

    inputRef.current?.focus()
  }, [])

  /* Debounced history search */
  useEffect(() => {
    if (!query || query.length < 2) {
      setHistoryResults([])
      return
    }

    const timer = setTimeout(() => {
      chrome.history
        .search({ text: query, maxResults: 6, startTime: 0 })
        .then((results) => {
          const tabUrls = new Set(tabs.map((t) => t.url))
          setHistoryResults(
            results
              .filter(
                (r) =>
                  r.url && !tabUrls.has(r.url) && !r.url.startsWith('chrome://')
              )
              .slice(0, 5)
              .map((r) => ({
                title: r.title || getDomain(r.url),
                url: r.url,
              }))
          )
        })
        .catch(() => {})
    }, 120)

    return () => clearTimeout(timer)
  }, [query, tabs])

  /* Fuse.js fuzzy search instance */
  const fuse = useMemo(
    () => new Fuse(tabs, { keys: ['title', 'url'], threshold: 0.4 }),
    [tabs]
  )

  /* Computed combined results list */
  const results = useMemo(() => {
    const items = []

    if (!query) {
      // Show first 6 open tabs when no query
      tabs.slice(0, 6).forEach((t) =>
        items.push({
          kind: 'tab',
          title: t.title,
          url: t.url,
          favIconUrl: t.favIconUrl,
          tabId: t.id,
        })
      )
      return items
    }

    // Fuzzy-matched tabs
    fuse
      .search(query)
      .slice(0, 5)
      .forEach((r) =>
        items.push({
          kind: 'tab',
          title: r.item.title,
          url: r.item.url,
          favIconUrl: r.item.favIconUrl,
          tabId: r.item.id,
        })
      )

    // History results
    historyResults.forEach((r) =>
      items.push({ kind: 'history', title: r.title, url: r.url })
    )

    // URL navigation action
    if (isUrl(query)) {
      const url = /^https?:\/\//i.test(query) ? query : `https://${query}`
      items.push({ kind: 'url', title: `Open ${query}`, url })
    }

    // Google search action
    items.push({
      kind: 'search',
      title: `Search for "${query}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    })

    return items
  }, [query, tabs, historyResults, fuse])

  /* Reset active index on query change */
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  /* Select / activate a result */
  const selectResult = useCallback((item) => {
    if (item.kind === 'tab' && item.tabId) {
      chrome.tabs.update(item.tabId, { active: true })
      window.close()
    } else {
      window.location.href = item.url
    }
  }, [])

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        e.preventDefault()
        selectResult(results[activeIdx])
      }
      if (e.key === 'Escape') {
        setQuery('')
        inputRef.current?.focus()
      }
    },
    [results, activeIdx, selectResult]
  )

  /* Scroll active item into view */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  /* ── Render ── */

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #EEEAF8 0%, #E4DEFF 50%, #EAE6FF 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Greeting */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1A1825',
          marginBottom: 32,
          letterSpacing: -0.5,
        }}
      >
        {greeting} 👋
      </div>

      {/* Search card */}
      <div
        style={{
          width: 540,
          maxWidth: 'calc(100vw - 32px)',
          background: 'white',
          borderRadius: 16,
          boxShadow:
            '0 4px 24px rgba(124,106,247,0.15), 0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Search input row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 18px',
            height: 56,
            borderBottom:
              results.length > 0
                ? '1px solid rgba(0,0,0,0.06)'
                : 'none',
          }}
        >
          <SearchIcon stroke={accentColor} size={18} style={{ flexShrink: 0 }} />

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tabs, history, or type a URL…"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              fontFamily: 'inherit',
              color: '#1A1825',
              background: 'transparent',
              caretColor: accentColor,
            }}
          />

          {query && (
            <button
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(0,0,0,0.3)',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <>
            <div ref={listRef} style={{ maxHeight: 340, overflowY: 'auto' }}>
              {/* "Open Tabs" label when no query */}
              {!query && (
                <div
                  style={{
                    padding: '8px 18px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(0,0,0,0.3)',
                  }}
                >
                  Open Tabs
                </div>
              )}

              {results.map((item, idx) => (
                <div
                  key={`${item.kind}-${item.url}-${idx}`}
                  data-idx={idx}
                  onClick={() => selectResult(item)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 16px',
                    height: 48,
                    cursor: 'pointer',
                    background:
                      idx === activeIdx
                        ? 'rgba(124,106,247,0.07)'
                        : 'transparent',
                    borderLeft:
                      idx === activeIdx
                        ? `3px solid ${accentColor}`
                        : '3px solid transparent',
                    transition: 'background 80ms',
                  }}
                >
                  {/* Icon */}
                  {item.kind === 'tab' || item.kind === 'history' ? (
                    <Favicon
                      src={item.favIconUrl || getFaviconUrl(item.url)}
                      title={item.title}
                      size={20}
                    />
                  ) : (
                    KindIcon(item.kind)
                  )}

                  {/* Title & domain */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1A1825',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </div>
                    {(item.kind === 'tab' || item.kind === 'history') && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'rgba(0,0,0,0.4)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {getDomain(item.url)}
                      </div>
                    )}
                  </div>

                  {/* "Open" badge for tab results */}
                  {item.kind === 'tab' && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 20,
                        background: 'rgba(124,106,247,0.1)',
                        color: accentColor,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      Open
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Keyboard hints footer */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: '8px 18px',
                borderTop: '1px solid rgba(0,0,0,0.05)',
              }}
            >
              {[
                ['↑↓', 'navigate'],
                ['↵', 'open'],
                ['Esc', 'clear'],
              ].map(([key, label]) => (
                <span
                  key={key}
                  style={{
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.3)',
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(0,0,0,0.06)',
                      borderRadius: 4,
                      padding: '1px 5px',
                      fontFamily: 'monospace',
                      fontSize: 10,
                    }}
                  >
                    {key}
                  </span>{' '}
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom hint */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accentColor,
          }}
        />
        <span style={{ fontSize: 12, color: 'rgba(26,24,37,0.4)' }}>
          Ctrl+Space for command bar
        </span>
      </div>
    </div>
  )
}

export default NewTab
