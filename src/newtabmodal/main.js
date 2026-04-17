/**
 * New Tab Modal — centered popup window.
 *
 * Opened via Alt+T or Ctrl+T from content script / side panel.
 * Pure vanilla JS — no React, no build step dependencies, instant load & focus.
 *
 * Features:
 * - Auto-focused search input
 * - "Switch to Tab" for open tabs (MRU order)
 * - History suggestions
 * - URL detection → navigate directly
 * - Fallback → search with configured engine
 * - Esc to cancel
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function isUrl(text) {
  const t = text.trim()
  return /^https?:\/\//i.test(t) ||
    /^localhost(:\d+)?/i.test(t) ||
    /^\d{1,3}(\.\d{1,3}){3}/.test(t) ||
    /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}/i.test(t)
}

function toUrl(text) {
  if (/^https?:\/\//i.test(text)) return text
  return 'https://' + text
}

function getFallbackColor(str) {
  const P = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#FB923C']
  return P[(str || '?').charCodeAt(0) % P.length]
}

async function getSearchUrl(query) {
  const stored = await chrome.storage.local.get('arcSettings')
  const engine = stored.arcSettings?.searchEngine || 'brave'
  const q = encodeURIComponent(query)
  const engines = {
    brave:      `https://search.brave.com/search?q=${q}`,
    google:     `https://www.google.com/search?q=${q}`,
    duckduckgo: `https://duckduckgo.com/?q=${q}`,
    bing:       `https://www.bing.com/search?q=${q}`,
  }
  return engines[engine] || engines.brave
}

async function getAccentColor() {
  const stored = await chrome.storage.local.get('arcState')
  const state = stored.arcState
  if (state?.spaces && state.activeSpaceId) {
    const space = state.spaces.find(s => s.id === state.activeSpaceId)
    if (space?.color) return space.color
  }
  return '#8B7CF6'
}

async function loadOpenTabs() {
  const stored = await chrome.storage.local.get('arcState')
  const state = stored.arcState
  if (!state) return []

  const order = state.tabAccessOrder || []
  const tabs  = state.tabs || []

  const isInternal = url => !url || url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') || url.startsWith('brave://') ||
    url === 'about:blank'

  const mru = []
  for (const id of order) {
    const t = tabs.find(t => t.id === id)
    if (t && !isInternal(t.url)) {
      mru.push(t)
      if (mru.length >= 8) break
    }
  }
  return mru
}

async function searchHistory(query, excludeUrls = new Set()) {
  if (!query || query.length < 2) return []
  try {
    const results = await chrome.history.search({ text: query, maxResults: 8, startTime: 0 })
    return results
      .filter(r => r.url && !excludeUrls.has(r.url) &&
        !r.url.startsWith('chrome://') && !r.url.startsWith('brave://'))
      .slice(0, 5)
      .map(r => ({ title: r.title || getDomain(r.url), url: r.url }))
  } catch {
    return []
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let accentColor  = '#8B7CF6'
let openTabs     = []
let results      = []
let selectedIdx  = 0
let query        = ''
let historyTimer = null

// ── DOM refs ──────────────────────────────────────────────────────────────────

let inputEl, listEl, rootEl

// ── Render ────────────────────────────────────────────────────────────────────

function renderFavicon(item) {
  if (item.favIconUrl && !item.favIconUrl.startsWith('chrome://') && !item.favIconUrl.startsWith('brave://')) {
    const img = document.createElement('img')
    img.src = item.favIconUrl
    img.width = 18; img.height = 18
    img.style.cssText = 'border-radius:4px;object-fit:contain;flex-shrink:0;'
    img.onerror = () => img.replaceWith(renderFallback(item))
    return img
  }
  return renderFallback(item)
}

function renderFallback(item) {
  const src = getDomain(item.url) || item.title || '?'
  const span = document.createElement('span')
  span.style.cssText = `
    width:18px;height:18px;border-radius:4px;flex-shrink:0;
    background:${getFallbackColor(src)};color:#fff;
    font-size:9px;font-weight:700;text-transform:uppercase;
    display:flex;align-items:center;justify-content:center;
  `
  span.textContent = src[0].toUpperCase()
  return span
}

function renderActionIcon(type) {
  const span = document.createElement('span')
  const bg = type === 'search' ? accentColor : '#34D399'
  span.style.cssText = `
    width:18px;height:18px;border-radius:4px;flex-shrink:0;
    background:${bg};color:#fff;
    display:flex;align-items:center;justify-content:center;
  `
  span.innerHTML = type === 'search'
    ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
    : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
  return span
}

function renderList() {
  listEl.innerHTML = ''

  if (!results.length) {
    if (!query) {
      const empty = document.createElement('div')
      empty.style.cssText = 'padding:20px 16px;text-align:center;color:rgba(26,24,37,0.35);font-size:13px;'
      empty.textContent = 'Type to search tabs, history, or navigate to a URL'
      listEl.appendChild(empty)
    }
    return
  }

  // Section label when no query (showing recent tabs)
  if (!query && results.length) {
    const label = document.createElement('div')
    label.style.cssText = 'padding:8px 16px 3px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,24,37,0.35);'
    label.textContent = 'Recent Tabs'
    listEl.appendChild(label)
  }

  results.forEach((item, idx) => {
    const row = document.createElement('div')
    const isSelected = idx === selectedIdx
    const isSwitchTab = item.kind === 'switch'

    row.style.cssText = `
      display:flex;align-items:center;gap:11px;
      padding:0 14px;height:46px;cursor:pointer;
      border-left:2px solid ${isSelected ? accentColor : 'transparent'};
      background:${isSelected ? accentColor + '12' : isSwitchTab && !isSelected ? accentColor + '08' : 'transparent'};
      transition:background 60ms;
    `
    row.dataset.idx = idx
    row.addEventListener('mouseenter', () => { selectedIdx = idx; renderList() })
    row.addEventListener('click', () => confirm(idx))

    // Icon
    if (item.kind === 'search' || item.kind === 'url') {
      row.appendChild(renderActionIcon(item.kind))
    } else {
      row.appendChild(renderFavicon(item))
    }

    // Text
    const text = document.createElement('div')
    text.style.cssText = 'flex:1;min-width:0;'

    const title = document.createElement('div')
    title.style.cssText = `
      font-size:13.5px;color:#1A1825;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font-weight:${isSwitchTab ? 500 : 400};
    `
    title.textContent = item.title || item.label || item.url

    const sub = document.createElement('div')
    sub.style.cssText = 'font-size:11px;color:rgba(26,24,37,0.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
    sub.textContent = item.subtitle || getDomain(item.url) || ''

    text.appendChild(title)
    if (sub.textContent) text.appendChild(sub)
    row.appendChild(text)

    // Badge
    if (isSwitchTab) {
      const badge = document.createElement('div')
      badge.style.cssText = `
        display:flex;align-items:center;gap:4px;
        font-size:11.5px;font-weight:600;color:${accentColor};flex-shrink:0;
      `
      badge.innerHTML = `Switch to Tab <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`
      row.appendChild(badge)
    } else if (item.kind === 'history') {
      const badge = document.createElement('div')
      badge.style.cssText = 'color:rgba(26,24,37,0.25);flex-shrink:0;'
      badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
      row.appendChild(badge)
    }

    listEl.appendChild(row)
  })
}

// ── Build results list ────────────────────────────────────────────────────────

function buildResults(historyItems = []) {
  const q = query.trim().toLowerCase()
  results = []

  if (!q) {
    // No query: show recent open tabs
    openTabs.slice(0, 6).forEach(t => {
      results.push({ kind: 'switch', id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl })
    })
  } else {
    // Filter open tabs
    const matchedTabs = openTabs.filter(t =>
      t.title?.toLowerCase().includes(q) || t.url?.toLowerCase().includes(q)
    )
    matchedTabs.slice(0, 4).forEach((t, i) => {
      results.push({ kind: i === 0 ? 'switch' : 'tab', id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl })
    })

    // History
    const tabUrls = new Set(openTabs.map(t => t.url))
    historyItems.forEach(h => {
      if (!tabUrls.has(h.url)) results.push({ kind: 'history', ...h })
    })

    // URL action
    if (isUrl(q)) {
      results.push({ kind: 'url', label: `Open ${query.trim()}`, subtitle: 'Navigate to URL', url: toUrl(query.trim()) })
    }

    // Search action
    results.push({ kind: 'search', label: `Search "${query.trim()}"`, subtitle: 'Search the web', query: query.trim() })
  }

  selectedIdx = 0
  renderList()
}

// ── Confirm selection ─────────────────────────────────────────────────────────

async function confirm(idx = selectedIdx) {
  const item = results[idx]
  if (!item) return
  if (item.kind === 'switch' || item.kind === 'tab') {
    await chrome.tabs.update(item.id, { active: true }).catch(() => {})
  } else if (item.kind === 'history' || item.kind === 'url') {
    await chrome.tabs.create({ url: item.url }).catch(() => {})
  } else if (item.kind === 'search') {
    const url = await getSearchUrl(item.query)
    await chrome.tabs.create({ url }).catch(() => {})
  }
  window.close()
}

// ── Input handler ─────────────────────────────────────────────────────────────

function onInput(e) {
  query = e.target.value
  clearTimeout(historyTimer)

  if (!query.trim()) {
    buildResults([])
    return
  }

  // Build immediately with tabs only, then add history after debounce
  buildResults([])

  historyTimer = setTimeout(async () => {
    const tabUrls = new Set(openTabs.map(t => t.url))
    const hist = await searchHistory(query, tabUrls)
    buildResults(hist)
  }, 120)
}

function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIdx = Math.min(selectedIdx + 1, results.length - 1)
    renderList()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIdx = Math.max(selectedIdx - 1, 0)
    renderList()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    confirm()
  } else if (e.key === 'Escape') {
    window.close()
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

function applyStyles() {
  const style = document.createElement('style')
  style.textContent = `
    * { box-sizing:border-box; margin:0; padding:0; }
    html,body { width:100%;height:100%;overflow:hidden;background:transparent; }
    body {
      font-family:-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;
      font-size:13px;-webkit-font-smoothing:antialiased;
    }
    #root {
      width:100%;height:100%;
      background:#FFFFFF;
      border-radius:14px;
      box-shadow:0 24px 80px rgba(0,0,0,0.22),0 0 0 1px rgba(0,0,0,0.08);
      display:flex;flex-direction:column;overflow:hidden;
    }
    #search-row {
      display:flex;align-items:center;gap:10px;
      padding:0 16px;height:52px;flex-shrink:0;
      border-bottom:1px solid rgba(0,0,0,0.07);
    }
    #search-input {
      flex:1;border:none;outline:none;
      font-size:15.5px;font-family:inherit;
      color:#1A1825;background:transparent;
    }
    #search-input::placeholder { color:rgba(26,24,37,0.35); }
    #results {
      flex:1;overflow-y:auto;padding:6px 0;
      scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.1) transparent;
    }
    #results::-webkit-scrollbar { width:4px; }
    #results::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1);border-radius:4px; }
  `
  document.head.appendChild(style)
}

// ── Init ──────────────────────────────────────────────────────────────────────

;(async () => {
  accentColor = await getAccentColor()
  openTabs    = await loadOpenTabs()

  applyStyles()

  rootEl = document.getElementById('root')

  // Search row
  const searchRow = document.createElement('div')
  searchRow.id = 'search-row'

  const icon = document.createElement('span')
  icon.style.cssText = `color:${accentColor};flex-shrink:0;`
  icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`

  inputEl = document.createElement('input')
  inputEl.id = 'search-input'
  inputEl.type = 'text'
  inputEl.placeholder = 'Search tabs, history, or enter a URL…'
  inputEl.autocomplete = 'off'
  inputEl.spellcheck = false
  inputEl.style.caretColor = accentColor
  inputEl.addEventListener('input', onInput)
  inputEl.addEventListener('keydown', onKeydown)

  searchRow.appendChild(icon)
  searchRow.appendChild(inputEl)
  rootEl.appendChild(searchRow)

  // Results list
  listEl = document.createElement('div')
  listEl.id = 'results'
  rootEl.appendChild(listEl)

  // Initial render
  buildResults([])

  // Focus the input. On Windows, chrome.windows.create with focused:true
  // doesn't always grant OS focus immediately, so we retry for 500ms.
  const forceFocus = (attempts = 0) => {
    window.focus()
    inputEl.focus()
    if (document.activeElement !== inputEl && attempts < 8) {
      setTimeout(() => forceFocus(attempts + 1), 60)
    }
  }
  forceFocus()
  window.addEventListener('focus', () => inputEl.focus())
})()