/**
 * Arc-style Tab Switcher popup.
 *
 * Opens as a chrome.windows.create popup, centered on screen.
 * Shows MRU tabs, highlights the one being switched TO.
 * Keyboard: Tab / ArrowDown = next, Shift+Tab / ArrowUp = prev,
 *           Enter = confirm, Esc = cancel, releasing Ctrl = confirm.
 */

// ── Read state from storage ───────────────────────────────────────────────────

async function loadTabs() {
  return new Promise((resolve) => {
    chrome.storage.local.get('arcState', (result) => {
      const state = result.arcState
      if (!state) return resolve([])
      const order  = state.tabAccessOrder || []
      const tabs   = state.tabs || []
      const spaces = state.spaces || []

      const mru = []
      for (const id of order) {
        const t = tabs.find((t) => t.id === id)
        if (t && t.url && !isInternal(t.url)) {
          const space = spaces.find((s) => s.id === t.spaceId)
          mru.push({ ...t, spaceEmoji: space?.emoji || '', spaceColor: space?.color || '#8B7CF6' })
          if (mru.length >= 5) break
        }
      }

      // Fallback: if no access order, use recent-first from tabs
      if (mru.length === 0) {
        const sorted = [...tabs]
          .filter((t) => t.url && !isInternal(t.url))
          .sort((a, b) => b.openedAt - a.openedAt)
          .slice(0, 5)
        for (const t of sorted) {
          const space = spaces.find((s) => s.id === t.spaceId)
          mru.push({ ...t, spaceEmoji: space?.emoji || '', spaceColor: space?.color || '#8B7CF6' })
        }
      }

      resolve(mru)
    })
  })
}

async function getAccentColor() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['arcState', 'arcSettings'], (result) => {
      const state = result.arcState
      if (state?.spaces && state.activeSpaceId) {
        const space = state.spaces.find((s) => s.id === state.activeSpaceId)
        if (space?.color) return resolve(space.color)
      }
      resolve('#8B7CF6')
    })
  })
}

function isInternal(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('brave://') || url === 'about:blank'
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// ── Build UI ──────────────────────────────────────────────────────────────────

let tabs      = []
let selectedIdx = 1   // default: start at the previous (index 1)
let accentColor = '#8B7CF6'

function render() {
  const root = document.getElementById('root')
  root.innerHTML = ''

  tabs.forEach((tab, idx) => {
    const isSelected = idx === selectedIdx
    const isCurrent  = idx === 0   // the tab we're leaving (most recently active)

    const row = document.createElement('div')
    row.className = 'tab-row' + (isSelected ? ' selected' : '') + (isCurrent ? ' current' : '')
    row.dataset.idx = idx
    row.addEventListener('click', () => { selectedIdx = idx; confirm() })
    row.addEventListener('mouseenter', () => { selectedIdx = idx; render() })

    // Favicon
    const faviconWrap = document.createElement('div')
    faviconWrap.className = 'favicon-wrap'
    if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
      const img = document.createElement('img')
      img.src = tab.favIconUrl
      img.width = 20
      img.height = 20
      img.style.borderRadius = '4px'
      img.onerror = () => { faviconWrap.innerHTML = ''; faviconWrap.appendChild(makeFallback(tab)) }
      faviconWrap.appendChild(img)
    } else {
      faviconWrap.appendChild(makeFallback(tab))
    }

    // Text
    const textWrap = document.createElement('div')
    textWrap.className = 'text-wrap'

    const title = document.createElement('div')
    title.className = 'tab-title'
    title.textContent = tab.title || getDomain(tab.url) || 'New Tab'

    const domain = document.createElement('div')
    domain.className = 'tab-domain'
    domain.textContent = getDomain(tab.url)

    textWrap.appendChild(title)
    textWrap.appendChild(domain)

    // Space emoji
    const spaceBadge = document.createElement('span')
    spaceBadge.className = 'space-badge'
    spaceBadge.textContent = tab.spaceEmoji

    // Direction label
    if (isCurrent) {
      const label = document.createElement('span')
      label.className = 'dir-label from'
      label.textContent = 'current'
      row.appendChild(faviconWrap)
      row.appendChild(textWrap)
      row.appendChild(spaceBadge)
      row.appendChild(label)
    } else if (isSelected) {
      const label = document.createElement('span')
      label.className = 'dir-label to'
      label.textContent = 'switching to →'
      row.appendChild(faviconWrap)
      row.appendChild(textWrap)
      row.appendChild(spaceBadge)
      row.appendChild(label)
    } else {
      row.appendChild(faviconWrap)
      row.appendChild(textWrap)
      row.appendChild(spaceBadge)
    }

    root.appendChild(row)
  })

  // Scroll selected into view
  const selEl = root.querySelector('.selected')
  selEl?.scrollIntoView({ block: 'nearest' })
}

function makeFallback(tab) {
  const PALETTE = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#FB923C']
  const source  = getDomain(tab.url) || tab.title || '?'
  const letter  = source[0].toUpperCase()
  const color   = PALETTE[source.charCodeAt(0) % PALETTE.length]
  const span = document.createElement('span')
  span.className = 'favicon-fallback'
  span.style.background = color
  span.textContent = letter
  return span
}

// ── Navigation ────────────────────────────────────────────────────────────────

function next()    { selectedIdx = Math.min(selectedIdx + 1, tabs.length - 1); render() }
function prev()    { selectedIdx = Math.max(selectedIdx - 1, 0); render() }

function confirm() {
  const tab = tabs[selectedIdx]
  if (tab) {
    chrome.tabs.update(tab.id, { active: true }).catch(() => {})
  }
  window.close()
}

function cancel() {
  window.close()
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    e.shiftKey ? prev() : next()
    return
  }
  if (e.key === 'ArrowDown')  { e.preventDefault(); next(); return }
  if (e.key === 'ArrowUp')    { e.preventDefault(); prev(); return }
  if (e.key === 'Enter')      { e.preventDefault(); confirm(); return }
  if (e.key === 'Escape')     { e.preventDefault(); cancel(); return }
})

// Ctrl-release = confirm (like macOS Cmd+Tab)
document.addEventListener('keyup', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') confirm()
})

// ── Styles ────────────────────────────────────────────────────────────────────

function applyStyles() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const bg     = isDark ? '#1A1825' : '#FFFFFF'
  const text   = isDark ? 'rgba(255,255,255,0.92)' : '#1A1825'
  const sub    = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,24,37,0.45)'
  const hov    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    body {
      font-family: -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }

    #root {
      background: ${bg};
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.12);
      padding: 6px 0;
      user-select: none;
    }

    .tab-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 60ms;
      border-left: 3px solid transparent;
    }
    .tab-row:hover {
      background: ${hov};
    }
    .tab-row.current {
      opacity: 0.5;
    }
    .tab-row.selected {
      background: ${accentColor}22;
      border-left-color: ${accentColor};
    }

    .favicon-wrap {
      width: 20px; height: 20px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .favicon-fallback {
      width: 20px; height: 20px; border-radius: 4px;
      color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }

    .text-wrap { flex: 1; min-width: 0; }
    .tab-title {
      font-size: 13.5px; font-weight: 500; color: ${text};
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tab-row.current .tab-title { font-weight: 400; }
    .tab-domain {
      font-size: 11px; color: ${sub};
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-top: 1px;
    }
    .tab-row.selected .tab-title { color: ${accentColor}; }

    .space-badge { font-size: 13px; flex-shrink: 0; }

    .dir-label {
      font-size: 10.5px; font-weight: 600; flex-shrink: 0;
      padding: 2px 7px; border-radius: 10px;
    }
    .dir-label.from {
      color: ${sub};
      background: ${divider};
    }
    .dir-label.to {
      color: ${accentColor};
      background: ${accentColor}22;
    }
  `

  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  // Make body transparent (popup bg from OS)
  document.body.style.background = 'transparent'
}

// ── Footer hint (shown below the list) ───────────────────────────────────────

function appendFooter() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const hintColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(26,24,37,0.3)'
  const keyBg     = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const footer = document.createElement('div')
  footer.style.cssText = `
    display: flex; gap: 14px; padding: 8px 16px 6px;
    border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'};
    font-size: 10.5px; color: ${hintColor};
    font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
  `
  const hints = [['Tab', 'cycle'], ['↵', 'switch'], ['Esc', 'cancel']]
  for (const [key, label] of hints) {
    const span = document.createElement('span')
    span.style.display = 'flex'; span.style.gap = '4px'; span.style.alignItems = 'center'
    const kbd = document.createElement('span')
    kbd.style.cssText = `background: ${keyBg}; border-radius: 3px; padding: 1px 5px; font-size: 10px;`
    kbd.textContent = key
    span.appendChild(kbd)
    span.appendChild(document.createTextNode(label))
    footer.appendChild(span)
  }
  document.getElementById('root').appendChild(footer)
}

// ── Init ──────────────────────────────────────────────────────────────────────

;(async () => {
  accentColor = await getAccentColor()
  applyStyles()
  tabs = await loadTabs()

  if (tabs.length === 0) { window.close(); return }

  // Start at index 1 (= previous tab), clamped if only 1 tab
  selectedIdx = Math.min(1, tabs.length - 1)

  render()
  appendFooter()

  // Focus the window so it receives keyboard events immediately
  window.focus()
})()