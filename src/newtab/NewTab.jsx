import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isUrl(str) {
  if (!str) return false
  const s = str.trim()
  if (/^https?:\/\//i.test(s)) return true
  if (/^localhost(:\d+)?/i.test(s)) return true
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(s)) return true
  if (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}/i.test(s)) return true
  return false
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function getFaviconSrc(favIconUrl) {
  if (!favIconUrl) return null
  if (favIconUrl === 'data:') return null
  if (favIconUrl.startsWith('chrome://') || favIconUrl.startsWith('chrome-extension://') || favIconUrl.startsWith('brave://')) return null
  return favIconUrl
}

function getFallback(title, url) {
  const PALETTE = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#FB923C','#A78BFA']
  const source  = getDomain(url) || title || '?'
  const letter  = source[0].toUpperCase()
  const color   = PALETTE[(source || '?').charCodeAt(0) % PALETTE.length]
  return { letter, color }
}

/**
 * Get the search engine URL from settings (Brave / Google / DuckDuckGo / Bing).
 * Defaults to Brave Search.
 */
async function getSearchUrl(query) {
  const stored = await chrome.storage.local.get('arcSettings')
  const engine = stored.arcSettings?.searchEngine || 'brave'
  const engines = {
    brave:      `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
    google:     `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    bing:       `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  }
  return engines[engine] || engines.brave
}

// ── Favicon component ─────────────────────────────────────────────────────────

function FavIcon({ src, title, url, size = 18 }) {
  const [err, setErr] = useState(false)
  const fb = getFallback(title, url)
  const s = getFaviconSrc(src)
  if (s && !err) {
    return <img src={s} width={size} height={size} style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} onError={() => setErr(true)} alt="" />
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: 4, background: fb.color,
      color: '#fff', fontSize: size * 0.5, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, textTransform: 'uppercase',
    }}>
      {fb.letter}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewTab() {
  const [query, setQuery]               = useState('')
  const [tabs, setTabs]                 = useState([])
  const [historyItems, setHistoryItems] = useState([])
  const [accentColor, setAccentColor]   = useState('#8B7CF6')
  const [prevTab, setPrevTab]           = useState(null)  // previously active tab
  const [activeIdx, setActiveIdx]       = useState(0)
  const [greeting, setGreeting]         = useState('Good morning')
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // ── Setup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

    chrome.storage.local.get('arcState', (data) => {
      const state = data.arcState
      if (state?.spaces && state.activeSpaceId) {
        const space = state.spaces.find((s) => s.id === state.activeSpaceId)
        if (space?.color) setAccentColor(space.color)
      }
    })

    // Load tabs + find previously active tab
    chrome.tabs.query({}).then((allTabs) => {
      const current = allTabs.find((t) => t.active)
      const userTabs = allTabs.filter(
        (t) => t.id && t.url &&
          !t.url.startsWith('chrome-extension://') &&
          !t.url.startsWith('chrome://newtab') &&
          !t.url.startsWith('brave://newtab') &&
          !t.active
      )

      setTabs(
        userTabs.map((t) => ({
          id: t.id,
          title: t.title || getDomain(t.url || ''),
          url: t.url || '',
          favIconUrl: t.favIconUrl || '',
          lastAccessed: t.lastAccessed || 0,
        }))
      )

      // The most recently accessed non-new-tab = previous tab
      const sorted = [...userTabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      if (sorted[0]) setPrevTab(sorted[0])
    })

    inputRef.current?.focus()
  }, [])

  // ── Debounced history search ──────────────────────────────────────────────
  useEffect(() => {
    if (!query || query.length < 2) { setHistoryItems([]); return }
    const t = setTimeout(async () => {
      try {
        const results = await chrome.history.search({ text: query, maxResults: 6, startTime: 0 })
        const tabUrls = new Set(tabs.map((t) => t.url))
        setHistoryItems(
          results
            .filter((r) => r.url && !tabUrls.has(r.url) && !r.url.startsWith('chrome://') && !r.url.startsWith('brave://'))
            .slice(0, 5)
            .map((r) => ({ kind: 'history', title: r.title || getDomain(r.url), url: r.url }))
        )
      } catch {}
    }, 120)
    return () => clearTimeout(t)
  }, [query, tabs])

  // ── Fuse search ───────────────────────────────────────────────────────────
  const fuse = useMemo(
    () => new Fuse(tabs, { keys: ['title', 'url'], threshold: 0.4 }),
    [tabs]
  )

  const results = useMemo(() => {
    const items = []

    if (!query) {
      // No query: show previous tab as "Switch to Tab" if available, then recent tabs
      if (prevTab) {
        items.push({ kind: 'switch', id: prevTab.id, title: prevTab.title, url: prevTab.url, favIconUrl: prevTab.favIconUrl })
      }
      tabs.slice(0, 5).forEach((t) =>
        t !== prevTab && items.push({ kind: 'tab', ...t })
      )
      return items
    }

    // Query: fuzzy-matched tabs — if first result URL matches an existing tab show "Switch"
    const matched = fuse.search(query).slice(0, 6).map((r) => r.item)
    matched.forEach((t, i) => {
      items.push({ kind: i === 0 && matched.length > 0 ? 'switch' : 'tab', ...t })
    })

    // History results
    historyItems.forEach((r) => items.push(r))

    // URL / Search action
    if (isUrl(query)) {
      const url = /^https?:\/\//i.test(query) ? query : `https://${query}`
      items.push({ kind: 'action', icon: 'url', label: `Open ${query}`, subtitle: 'Navigate to URL', url })
    }
    items.push({ kind: 'action', icon: 'search', label: `Search "${query}"`, subtitle: 'Search the web', query })

    return items
  }, [query, fuse, tabs, historyItems, prevTab])

  useEffect(() => setActiveIdx(0), [query])

  // ── Scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    listRef.current?.children[activeIdx]?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // ── Select a result ───────────────────────────────────────────────────────
  const selectResult = useCallback(async (item) => {
    if (item.kind === 'switch' || item.kind === 'tab') {
      chrome.tabs.update(item.id, { active: true })
    } else if (item.kind === 'history') {
      chrome.tabs.create({ url: item.url })
    } else if (item.kind === 'action') {
      if (item.url) {
        chrome.tabs.create({ url: item.url })
      } else if (item.query) {
        const searchUrl = await getSearchUrl(item.query)
        chrome.tabs.create({ url: searchUrl })
      }
    }
  }, [])

  const handleKeyDown = useCallback(async (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIdx]) await selectResult(results[activeIdx])
    }
  }, [results, activeIdx, selectResult])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0EBF8 0%, #E8E3F5 60%, #E0DBF0 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 80,
      fontFamily: '-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif',
    }}>
      {/* Greeting */}
      <div style={{ fontSize: 22, fontWeight: 500, color: '#4A4566', marginBottom: 28 }}>
        {greeting}
      </div>

      {/* Search card */}
      <div style={{
        width: '100%', maxWidth: 600,
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: results.length > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tabs, history, or type a URL…"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 16, fontFamily: 'inherit', color: '#1A1825',
              background: 'transparent', caretColor: accentColor,
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', fontSize: 18, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div ref={listRef} style={{ maxHeight: 340, overflowY: 'auto' }}>
            {!query && results.length > 0 && (
              <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)' }}>
                {prevTab ? 'Switch Back' : 'Open Tabs'}
              </div>
            )}

            {results.map((item, idx) => (
              <ResultRow
                key={`${item.kind}-${item.url || item.label}-${idx}`}
                item={item}
                isActive={idx === activeIdx}
                accentColor={accentColor}
                onClick={() => selectResult(item)}
                onMouseEnter={() => setActiveIdx(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(74,69,102,0.5)', display: 'flex', gap: 12 }}>
        <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
        <span><kbd style={kbdStyle}>↵</kbd> open</span>
        <span><kbd style={kbdStyle}>Ctrl+Space</kbd> command bar</span>
      </div>
    </div>
  )
}

const kbdStyle = {
  background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '1px 6px',
  fontSize: 11, fontFamily: 'inherit', border: '1px solid rgba(0,0,0,0.1)',
}

function ResultRow({ item, isActive, accentColor, onClick, onMouseEnter }) {
  const isSwitchToTab = item.kind === 'switch'

  const bg = isSwitchToTab && isActive
    ? `${accentColor}30`
    : isSwitchToTab
    ? `${accentColor}14`
    : isActive
    ? `${accentColor}0d`
    : 'transparent'

  const leftBorder = isActive ? `3px solid ${accentColor}` : '3px solid transparent'

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 50, cursor: 'pointer',
        background: bg,
        borderLeft: leftBorder,
        transition: 'background 60ms',
      }}
    >
      {/* Icon */}
      {item.kind === 'tab' || item.kind === 'switch' || item.kind === 'history' ? (
        <FavIcon src={item.favIconUrl} title={item.title} url={item.url} size={18} />
      ) : (
        <span style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          background: item.icon === 'search' ? accentColor : '#34D399',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.icon === 'search'
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          }
        </span>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: '#1A1825', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isSwitchToTab ? 500 : 400 }}>
          {item.title || item.label || item.url}
        </div>
        {(item.url || item.subtitle) && (
          <div style={{ fontSize: 11, color: 'rgba(26,24,37,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.subtitle || getDomain(item.url)}
          </div>
        )}
      </div>

      {/* Switch to Tab badge */}
      {isSwitchToTab && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: accentColor, flexShrink: 0 }}>
          Switch to Tab
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      )}

      {item.kind === 'history' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,24,37,0.3)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      )}
    </div>
  )
}