import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import { getFaviconSrc, getFaviconFallback, isUrl } from '@shared/utils.js'
import { Messages } from '@shared/messages.js'

async function getSearchUrl(query) {
  const stored = await chrome.storage.local.get('arcSettings')
  const engine = stored.arcSettings?.searchEngine || 'brave'
  const map = {
    brave:      `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
    google:     `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    bing:       `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  }
  return map[engine] || map.brave
}

function FavIcon({ src, title, url, size = 18 }) {
  const [err, setErr] = useState(false)
  const s  = getFaviconSrc(src)
  const fb = getFaviconFallback(title, url)
  if (s && !err) {
    return (
      <img src={s} width={size} height={size}
        style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
        onError={() => setErr(true)} alt="" />
    )
  }
  return (
    <span className="new-tab-modal-result-fallback" style={{ background: fb.color, width: size, height: size }}>
      {fb.letter}
    </span>
  )
}

/**
 * Ctrl+T modal — Arc-style new tab / URL input overlay inside the side panel.
 */
export default function NewTabModal({ isOpen, onClose, tabs, accentColor }) {
  const [query, setQuery]     = useState('')
  const [history, setHistory] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setHistory([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Debounced history search
  useEffect(() => {
    if (!query || query.length < 2) { setHistory([]); return }
    const t = setTimeout(async () => {
      try {
        const results = await chrome.history.search({ text: query, maxResults: 5, startTime: 0 })
        const tabUrls = new Set(tabs.map((t) => t.url))
        setHistory(
          results
            .filter((r) => r.url && !tabUrls.has(r.url) && !r.url.startsWith('chrome://') && !r.url.startsWith('brave://'))
            .slice(0, 4)
            .map((r) => ({ kind: 'history', title: r.title || r.url, url: r.url, favIconUrl: '' }))
        )
      } catch {}
    }, 120)
    return () => clearTimeout(t)
  }, [query, tabs])

  const fuse = useMemo(
    () => new Fuse(tabs, { keys: ['title', 'url'], threshold: 0.4 }),
    [tabs]
  )

  const results = useMemo(() => {
    const items = []
    if (!query) return items

    const matched = fuse.search(query).slice(0, 5).map((r) => r.item)
    matched.forEach((t, i) => {
      items.push({ kind: i === 0 ? 'switch' : 'tab', id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl })
    })
    history.forEach((r) => items.push(r))

    if (isUrl(query)) {
      const url = /^https?:\/\//i.test(query) ? query : `https://${query}`
      items.push({ kind: 'action', icon: 'url', label: `Open ${query}`, url })
    }
    items.push({ kind: 'action', icon: 'search', label: `Search "${query}"`, query })
    return items
  }, [query, fuse, history])

  useEffect(() => setActiveIdx(0), [query])

  const select = useCallback(async (item) => {
    if (!item) return
    if (item.kind === 'switch' || item.kind === 'tab') {
      chrome.tabs.update(item.id, { active: true })
    } else if (item.kind === 'history') {
      chrome.tabs.create({ url: item.url })
    } else if (item.kind === 'action') {
      if (item.url) {
        chrome.tabs.create({ url: item.url })
      } else if (item.query) {
        const url = await getSearchUrl(item.query)
        chrome.tabs.create({ url })
      }
    }
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback(async (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); await select(results[activeIdx]) }
  }, [results, activeIdx, select, onClose])

  if (!isOpen) return null

  return (
    <div className="new-tab-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="new-tab-modal">
        {/* Search input */}
        <div className="new-tab-modal-search">
          <svg className="new-tab-modal-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="new-tab-modal-input"
            placeholder="Search tabs, history, or type a URL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            style={{ caretColor: accentColor }}
          />
          <span className="new-tab-modal-esc">ESC</span>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="new-tab-modal-results">
            {results.map((item, idx) => {
              const isSwitchToTab = item.kind === 'switch'
              return (
                <div
                  key={`${item.kind}-${item.url || item.label}-${idx}`}
                  className={[
                    'new-tab-modal-result',
                    idx === activeIdx ? 'selected' : '',
                    isSwitchToTab ? 'switch-to-tab' : '',
                  ].join(' ').trim()}
                  onClick={() => select(item)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {/* Icon */}
                  {item.kind === 'action' ? (
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      background: item.icon === 'search' ? accentColor : '#34D399',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.icon === 'search'
                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      }
                    </span>
                  ) : (
                    <FavIcon src={item.favIconUrl} title={item.title} url={item.url} size={18} />
                  )}

                  {/* Text */}
                  <div className="new-tab-modal-result-text">
                    <div className="new-tab-modal-result-title">{item.title || item.label || item.url}</div>
                    {item.url && <div className="new-tab-modal-result-url">{item.url}</div>}
                  </div>

                  {/* Switch to Tab badge */}
                  {isSwitchToTab && (
                    <div className="new-tab-modal-switch-badge">
                      Switch to Tab
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Hint footer */}
        <div className="new-tab-modal-hint">
          <span><span className="new-tab-modal-hint-key">↑↓</span> navigate</span>
          <span><span className="new-tab-modal-hint-key">↵</span> open</span>
          <span><span className="new-tab-modal-hint-key">Esc</span> close</span>
        </div>
      </div>
    </div>
  )
}