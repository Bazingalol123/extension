import React from 'react'
import { createRoot } from 'react-dom/client'
import { Messages } from '@shared/messages.js'
import CommandBar from './CommandBar.jsx'
import CSS_STRING from './commandbar.css?inline'

// ─── Command Bar (unchanged) ──────────────────────────────────────────────────

let host = null, shadow = null, root = null, isOpen = false

async function getAccentColor() {
  return new Promise((resolve) => {
    chrome.storage.local.get('arcState', (r) => {
      const s = r.arcState
      if (s?.spaces && s.activeSpaceId) {
        const sp = s.spaces.find((x) => x.id === s.activeSpaceId)
        resolve(sp?.color ?? '#8B7CF6')
      } else resolve('#8B7CF6')
    })
  })
}

function ensureHost() {
  if (host) return
  host = document.createElement('div')
  host.id = 'arc-cmdbar-host'
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  document.documentElement.appendChild(host)
  shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = CSS_STRING
  shadow.appendChild(style)
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  shadow.appendChild(container)
  root = createRoot(container)
}

async function openCommandBar() {
  if (isOpen) return
  isOpen = true
  ensureHost()
  const accentColor = await getAccentColor()
  root.render(<div style={{ pointerEvents: 'all' }}><CommandBar accentColor={accentColor} onClose={closeCommandBar} /></div>)
}

function closeCommandBar() { isOpen = false; root?.render(null) }

// ─── Tab Switcher overlay ─────────────────────────────────────────────────────
//
// KEY DESIGN DECISIONS:
//
// 1. NO SERVICE WORKER ROUNDTRIP for showing the overlay.
//    Content script reads arcState from chrome.storage.local directly.
//    This is why it now works WITHOUT clicking the extension UI first —
//    we don't need the SW to be awake just to open the switcher.
//
// 2. Screenshots fetched ASYNCHRONOUSLY after overlay appears.
//    SW returns cached screenshots via TAB_SWITCHER_GET_SCREENSHOTS.
//    Also tells SW to capture the current active tab fresh (has permission
//    because user just pressed Ctrl+Q = user interaction with extension).
//
// 3. Ctrl+Q while open = CYCLE FORWARD (wrap). Shift+Ctrl+Q = cycle back.
//
// 4. No footer.

let swHost = null, swShadow = null, swContainer = null
let swTabs = [], swIdx = 1, swAccent = '#8B7CF6', swOpen = false

const SWITCHER_CSS = `
  * { box-sizing:border-box; margin:0; padding:0; }
  .sw-wrap {
    position:fixed; bottom:44px; left:50%;
    transform:translateX(-50%);
    pointer-events:all;
    animation:sw-in 0.13s cubic-bezier(0.34,1.2,0.64,1);
  }
  @keyframes sw-in {
    from { opacity:0; transform:translateX(-50%) translateY(12px) scale(0.96); }
    to   { opacity:1; transform:translateX(-50%) translateY(0)     scale(1);   }
  }
  .sw-cards {
    display:flex; gap:10px; padding:12px 14px;
    background:rgba(16,15,26,0.90);
    backdrop-filter:blur(28px) saturate(180%);
    -webkit-backdrop-filter:blur(28px) saturate(180%);
    border-radius:18px;
    border:1px solid rgba(255,255,255,0.09);
    box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(0,0,0,0.4);
  }
  .sw-card {
    width:160px; border-radius:10px; overflow:hidden;
    cursor:pointer; background:#1c1b2e;
    border:2px solid transparent;
    transition:border-color 0.1s,transform 0.12s,box-shadow 0.12s;
    flex-shrink:0; user-select:none;
  }
  .sw-card:hover { border-color:rgba(255,255,255,0.22); }
  .sw-card.selected {
    border-color:var(--accent,#8B7CF6);
    box-shadow:0 0 0 1px var(--accent,#8B7CF6),0 6px 24px rgba(0,0,0,0.4);
    transform:translateY(-4px);
  }
  .sw-thumb { width:160px;height:106px;object-fit:cover;object-position:top;display:block;background:#111020; }
  .sw-thumb-empty { width:160px;height:106px;background:#111020;display:flex;align-items:center;justify-content:center;font-size:30px;color:rgba(255,255,255,0.12); }
  .sw-info { display:flex;align-items:center;gap:6px;padding:7px 8px 8px;background:#1c1b2e;border-top:1px solid rgba(255,255,255,0.05); }
  .sw-favicon { width:14px;height:14px;border-radius:3px;flex-shrink:0;object-fit:contain; }
  .sw-favicon-fallback { width:14px;height:14px;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;text-transform:uppercase; }
  .sw-title { font-size:11.5px;font-family:-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;color:rgba(255,255,255,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;line-height:1; }
  .sw-card.selected .sw-title { color:rgba(255,255,255,0.95); }
  .sw-focus-trap { position:absolute;opacity:0;width:1px;height:1px;pointer-events:none; }
`

function ensureSwitcherHost() {
  if (swHost) return
  swHost = document.createElement('div')
  swHost.id = 'arc-switcher-host'
  swHost.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;'
  document.documentElement.appendChild(swHost)
  swShadow = swHost.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = SWITCHER_CSS
  swShadow.appendChild(style)
  swContainer = document.createElement('div')
  swContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;'
  swShadow.appendChild(swContainer)
}

function getDomain(url) { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
function getFallbackColor(s) { const P=['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#FB923C']; return P[(s||'?').charCodeAt(0)%P.length] }

function makeFavFallback(tab) {
  const span = document.createElement('span')
  span.className = 'sw-favicon-fallback'
  const src = getDomain(tab.url) || tab.title || '?'
  span.style.background = getFallbackColor(src)
  span.textContent = src[0].toUpperCase()
  return span
}

/** Update selected highlight without rebuilding DOM */
function updateSelection() {
  swContainer?.querySelectorAll('.sw-card').forEach((c, i) => c.classList.toggle('selected', i === swIdx))
}

/** Inject screenshot into a card without rebuilding */
function applyScreenshot(idx, dataUrl) {
  const card = swContainer?.querySelector(`.sw-card[data-idx="${idx}"]`)
  if (!card) return
  const old = card.querySelector('.sw-thumb,.sw-thumb-empty')
  if (!old) return
  const img = document.createElement('img')
  img.className = 'sw-thumb'
  img.src = dataUrl
  img.alt = ''
  old.replaceWith(img)
}

function buildOverlay() {
  if (!swContainer) return
  swContainer.innerHTML = ''
  swContainer.style.setProperty('--accent', swAccent)

  const wrap = document.createElement('div')
  wrap.className = 'sw-wrap'

  const trap = document.createElement('input')
  trap.className = 'sw-focus-trap'
  trap.setAttribute('aria-hidden', 'true')
  wrap.appendChild(trap)

  const cards = document.createElement('div')
  cards.className = 'sw-cards'

  swTabs.forEach((tab, idx) => {
    const card = document.createElement('div')
    card.className = 'sw-card' + (idx === swIdx ? ' selected' : '')
    card.dataset.idx = idx
    card.addEventListener('click', () => { swIdx = idx; confirmSwitcher() })
    card.addEventListener('mouseenter', () => { swIdx = idx; updateSelection() })

    if (tab.screenshot) {
      const img = document.createElement('img')
      img.className = 'sw-thumb'
      img.src = tab.screenshot
      img.alt = ''
      card.appendChild(img)
    } else {
      const ph = document.createElement('div')
      ph.className = 'sw-thumb-empty'
      ph.textContent = tab.spaceEmoji || '🌐'
      card.appendChild(ph)
    }

    const info = document.createElement('div')
    info.className = 'sw-info'
    const favSrc = tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') && !tab.favIconUrl.startsWith('brave://') ? tab.favIconUrl : null
    if (favSrc) {
      const img = document.createElement('img')
      img.className = 'sw-favicon'
      img.src = favSrc
      img.onerror = () => img.replaceWith(makeFavFallback(tab))
      info.appendChild(img)
    } else { info.appendChild(makeFavFallback(tab)) }

    const title = document.createElement('span')
    title.className = 'sw-title'
    title.textContent = tab.title || getDomain(tab.url) || 'Tab'
    info.appendChild(title)
    card.appendChild(info)
    cards.appendChild(card)
  })

  wrap.appendChild(cards)
  swContainer.appendChild(wrap)

  // Focus the trap, then add race-robustness: if user already released
  // all modifier keys before focus arrived, auto-confirm their selection.
 requestAnimationFrame(() => trap.focus())

  trap.addEventListener('keydown', (e) => {
    const len = swTabs.length
    if (!len) return
    if ((e.key === 'q' || e.key === 'Q') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      swIdx = e.shiftKey ? (swIdx - 1 + len) % len : (swIdx + 1) % len
      updateSelection(); return
    }
    if (e.key === 'Tab') { e.preventDefault(); swIdx = e.shiftKey ? (swIdx-1+len)%len : (swIdx+1)%len; updateSelection(); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); swIdx=(swIdx+1)%len; updateSelection() }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); swIdx=(swIdx-1+len)%len; updateSelection() }
    if (e.key === 'Enter')  { e.preventDefault(); confirmSwitcher() }
    if (e.key === 'Escape') { e.preventDefault(); closeSwitcher() }
  })
  trap.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') confirmSwitcher()
  })
}

async function buildTabsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get('arcState', (result) => {
      const state = result.arcState
      if (!state) return resolve({ tabs: [], accentColor: '#8B7CF6' })
      const order  = state.tabAccessOrder || []
      const allTabs = state.tabs || []
      const spaces = state.spaces || []
      const activeSpace = spaces.find((s) => s.id === state.activeSpaceId)
      const isInternal = (url) => !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('brave://') || url === 'about:blank'
      const mru = []
      for (const id of order) {
        const t = allTabs.find((t) => t.id === id)
        if (t && !isInternal(t.url)) {
          const space = spaces.find((s) => s.id === t.spaceId)
          mru.push({ ...t, screenshot: null, spaceEmoji: space?.emoji || '', spaceColor: space?.color || '#8B7CF6' })
          if (mru.length >= 5) break
        }
      }
      resolve({ tabs: mru, accentColor: activeSpace?.color || '#8B7CF6' })
    })
  })
}

async function fetchScreenshots(tabIds) {
  try {
    const res = await chrome.runtime.sendMessage({ type: Messages.TAB_SWITCHER_GET_SCREENSHOTS, tabIds })
    if (!res?.screenshots) return
    swTabs.forEach((tab, idx) => {
      const url = res.screenshots[tab.id]
      if (url) { tab.screenshot = url; applyScreenshot(idx, url) }
    })
  } catch (_) {}
}

async function triggerSwitcher() {
  if (swOpen) {
    // Already open — just cycle forward
    const len = swTabs.length
    if (len) { swIdx = (swIdx + 1) % len; updateSelection() }
    return
  }

  ensureSwitcherHost()
  const { tabs, accentColor } = await buildTabsFromStorage()
  if (!tabs.length) return

  swTabs   = tabs
  swIdx    = Math.min(1, tabs.length - 1)
  swAccent = accentColor
  swOpen   = true
  buildOverlay()

  // Fetch cached screenshots + trigger fresh capture of current tab
  const tabIds = tabs.map((t) => t.id)
  fetchScreenshots(tabIds)
  chrome.runtime.sendMessage({ type: Messages.TAB_SWITCHER_CAPTURE_CURRENT }).catch(() => {})
}

function confirmSwitcher() {
  const tab = swTabs[swIdx]
  if (tab) {
    // chrome.tabs is NOT available in content scripts — relay via SW
    chrome.runtime.sendMessage({ type: Messages.ACTIVATE_TAB, tabId: tab.id }).catch(() => {})
  }
  closeSwitcher()
}

function closeSwitcher() {
  swOpen = false
  if (swContainer) swContainer.innerHTML = ''
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === Messages.OPEN_COMMAND_BAR) {
    isOpen ? closeCommandBar() : openCommandBar()
  }
  if (message.type === Messages.TAB_SWITCHER_OPEN) {
    // Triggered from sidebar (sidebar has focus)
    if (swOpen) {
      const len = swTabs.length
      if (len) { swIdx = (swIdx + 1) % len; updateSelection() }
    } else {
      // SW already built the tabs+screenshots list, use it directly
      swTabs   = message.tabs || []
      swIdx    = Math.min(1, swTabs.length - 1)
      swAccent = message.accentColor || '#8B7CF6'
      if (swTabs.length) { ensureSwitcherHost(); swOpen = true; buildOverlay() }
    }
  }
  if (message.type === Messages.TAB_SWITCHER_CLOSE) closeSwitcher()
})

// ─── Page-level keyboard shortcuts ───────────────────────────────────────────
// Capture phase so they run before any page handler.

document.addEventListener('keydown', (e) => {
  // Ctrl+Q — Tab Switcher overlay
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
    e.preventDefault()
    e.stopPropagation()
    triggerSwitcher()
    return
  }

  // Alt+T — New Tab Modal popup window
  // Ctrl+T is handled by the manifest command in the SW, but Alt+T is
  // intercepted here since it's not a reserved browser shortcut.
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 't') {
    e.preventDefault()
    e.stopPropagation()
    chrome.runtime.sendMessage({
      type: Messages.NEW_TAB_MODAL_OPEN,
      screenWidth:  window.screen.width,
      screenHeight: window.screen.height,
    }).catch(() => {})
    return
  }
}, true)