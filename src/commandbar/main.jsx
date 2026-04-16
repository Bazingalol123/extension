import React from 'react'
import { createRoot } from 'react-dom/client'
import { Messages } from '@shared/messages.js'
import CommandBar from './CommandBar.jsx'
import CSS_STRING from './commandbar.css?inline'

// ─── Command Bar (existing) ───────────────────────────────────────────────────

let host     = null
let shadow   = null
let root     = null
let isOpen   = false

async function getAccentColor() {
  return new Promise((resolve) => {
    chrome.storage.local.get('arcState', (result) => {
      const state = result.arcState
      if (state?.spaces && state.activeSpaceId) {
        const space = state.spaces.find((s) => s.id === state.activeSpaceId)
        resolve(space?.color ?? '#8B7CF6')
      } else {
        resolve('#8B7CF6')
      }
    })
  })
}

function ensureHost() {
  if (host) return
  host = document.createElement('div')
  host.id = 'arc-cmdbar-host'
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;'
  document.documentElement.appendChild(host)
  shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = CSS_STRING
  shadow.appendChild(style)
  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;'
  shadow.appendChild(container)
  root = createRoot(container)
}

const CommandBarWrapper = ({ accentColor, onClose }) => (
  <div style={{ pointerEvents: 'all' }}>
    <CommandBar accentColor={accentColor} onClose={onClose} />
  </div>
)

async function openCommandBar() {
  if (isOpen) return
  isOpen = true
  ensureHost()
  const accentColor = await getAccentColor()
  root.render(<CommandBarWrapper accentColor={accentColor} onClose={closeCommandBar} />)
}

function closeCommandBar() {
  isOpen = false
  root?.render(null)
}

// ─── Tab Switcher Overlay ─────────────────────────────────────────────────────
// Arc-style horizontal card strip, rendered as a separate shadow DOM overlay
// directly on the page — no popup window, no browser chrome around it.

let swHost   = null   // shadow host element
let swShadow = null   // shadow root
let swContainer = null // container div inside shadow

// In-memory selected index (managed imperatively to avoid React re-render latency)
let swTabs      = []
let swIdx       = 1
let swAccent    = '#8B7CF6'
let swOpen      = false

const SWITCHER_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .sw-wrap {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: all;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    animation: sw-in 0.14s cubic-bezier(0.34,1.2,0.64,1);
  }

  @keyframes sw-in {
    from { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.96); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
  }

  .sw-cards {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    background: rgba(18, 17, 28, 0.88);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow: 0 16px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3);
  }

  .sw-card {
    width: 162px;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    background: #1e1d2e;
    border: 2px solid transparent;
    transition: border-color 0.1s, box-shadow 0.1s, transform 0.1s;
    flex-shrink: 0;
    user-select: none;
  }

  .sw-card:hover {
    border-color: rgba(255,255,255,0.25);
  }

  .sw-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 4px 20px rgba(0,0,0,0.4);
    transform: translateY(-3px);
  }

  .sw-thumb {
    width: 162px;
    height: 108px;
    object-fit: cover;
    object-position: top;
    display: block;
    background: #12111e;
  }

  .sw-thumb-empty {
    width: 162px;
    height: 108px;
    background: #12111e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: rgba(255,255,255,0.15);
  }

  .sw-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px 8px;
    background: #1e1d2e;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .sw-favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
    object-fit: contain;
  }

  .sw-favicon-fallback {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 700;
    color: #fff;
    text-transform: uppercase;
  }

  .sw-title {
    font-size: 11px;
    font-family: -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
    color: rgba(255,255,255,0.70);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    line-height: 1;
  }

  .sw-card.selected .sw-title {
    color: rgba(255,255,255,0.95);
  }

  .sw-hint {
    margin-top: 6px;
    font-size: 10.5px;
    font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
    color: rgba(255,255,255,0.28);
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .sw-hint kbd {
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10px;
    font-family: inherit;
  }

  /* hidden focus trap */
  .sw-focus-trap {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
`

function ensureSwitcherHost() {
  if (swHost) return

  swHost = document.createElement('div')
  swHost.id = 'arc-switcher-host'
  swHost.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;'
  document.documentElement.appendChild(swHost)

  swShadow = swHost.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = SWITCHER_CSS
  swShadow.appendChild(style)

  swContainer = document.createElement('div')
  swContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none;'
  swShadow.appendChild(swContainer)
}

function getFallbackColor(str) {
  const PALETTE = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#FB923C']
  return PALETTE[(str || '?').charCodeAt(0) % PALETTE.length]
}

function renderSwitcher() {
  if (!swContainer || !swOpen) return

  swContainer.innerHTML = ''
  swContainer.style.setProperty('--accent', swAccent)

  const wrap = document.createElement('div')
  wrap.className = 'sw-wrap'

  // Focus trap input — captures keyboard events when focused
  const trap = document.createElement('input')
  trap.className = 'sw-focus-trap'
  trap.setAttribute('aria-hidden', 'true')
  wrap.appendChild(trap)

  // Cards row
  const cards = document.createElement('div')
  cards.className = 'sw-cards'

  swTabs.forEach((tab, idx) => {
    const card = document.createElement('div')
    card.className = 'sw-card' + (idx === swIdx ? ' selected' : '')
    card.addEventListener('click', () => { swIdx = idx; confirmSwitcher() })
    card.addEventListener('mouseenter', () => {
      swIdx = idx
      swContainer.querySelectorAll('.sw-card').forEach((c, i) => {
        c.classList.toggle('selected', i === swIdx)
      })
    })

    // Screenshot or placeholder
    if (tab.screenshot) {
      const img = document.createElement('img')
      img.className = 'sw-thumb'
      img.src = tab.screenshot
      img.alt = ''
      card.appendChild(img)
    } else {
      const placeholder = document.createElement('div')
      placeholder.className = 'sw-thumb-empty'
      placeholder.textContent = tab.spaceEmoji || '🌐'
      card.appendChild(placeholder)
    }

    // Info row: favicon + title
    const info = document.createElement('div')
    info.className = 'sw-info'

    const favSrc = tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') ? tab.favIconUrl : null
    if (favSrc) {
      const fav = document.createElement('img')
      fav.className = 'sw-favicon'
      fav.src = favSrc
      fav.onerror = () => { fav.replaceWith(makeFavFallback(tab)) }
      info.appendChild(fav)
    } else {
      info.appendChild(makeFavFallback(tab))
    }

    const title = document.createElement('span')
    title.className = 'sw-title'
    let domain = ''
    try { domain = new URL(tab.url).hostname.replace(/^www\./, '') } catch {}
    title.textContent = tab.title || domain || 'Tab'
    info.appendChild(title)

    card.appendChild(info)
    cards.appendChild(card)
  })

  wrap.appendChild(cards)

  // Keyboard hint
  const hint = document.createElement('div')
  hint.className = 'sw-hint'
  hint.innerHTML = '<kbd>Q</kbd> cycle &nbsp; <kbd>↵</kbd> switch &nbsp; <kbd>Esc</kbd> cancel'
  wrap.appendChild(hint)

  swContainer.appendChild(wrap)

  // Focus the trap so keyboard events land here, not in the side panel
  requestAnimationFrame(() => trap.focus())

  // Keyboard handling
  trap.addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'Q' || e.key === 'Tab') {
      e.preventDefault()
      swIdx = e.shiftKey || e.key === 'Q'
        ? Math.max(swIdx - 1, 0)
        : Math.min(swIdx + 1, swTabs.length - 1)
      swContainer.querySelectorAll('.sw-card').forEach((c, i) => c.classList.toggle('selected', i === swIdx))
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); swIdx = Math.min(swIdx + 1, swTabs.length - 1); swContainer.querySelectorAll('.sw-card').forEach((c, i) => c.classList.toggle('selected', i === swIdx)) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); swIdx = Math.max(swIdx - 1, 0);                  swContainer.querySelectorAll('.sw-card').forEach((c, i) => c.classList.toggle('selected', i === swIdx)) }
    if (e.key === 'Enter') { e.preventDefault(); confirmSwitcher() }
    if (e.key === 'Escape') { e.preventDefault(); closeSwitcher() }
  })

  // Ctrl/Meta release = confirm (like macOS Cmd+Tab)
  trap.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') confirmSwitcher()
  })
}

function makeFavFallback(tab) {
  const span = document.createElement('span')
  span.className = 'sw-favicon-fallback'
  let domain = ''
  try { domain = new URL(tab.url).hostname.replace(/^www\./, '') } catch {}
  span.style.background = getFallbackColor(domain || tab.title)
  span.textContent = (domain || tab.title || '?')[0].toUpperCase()
  return span
}

function openSwitcher(tabs, accentColor) {
  ensureSwitcherHost()
  swTabs   = tabs
  swIdx    = Math.min(1, tabs.length - 1)
  swAccent = accentColor || '#8B7CF6'
  swOpen   = true
  renderSwitcher()
}

function confirmSwitcher() {
  const tab = swTabs[swIdx]
  if (tab) chrome.tabs.update(tab.id, { active: true }).catch(() => {})
  closeSwitcher()
}

function closeSwitcher() {
  swOpen = false
  if (swContainer) swContainer.innerHTML = ''
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === Messages.OPEN_COMMAND_BAR) {
    isOpen ? closeCommandBar() : openCommandBar()
  }

  if (message.type === Messages.TAB_SWITCHER_OPEN) {
    if (swOpen) {
      closeSwitcher()
    } else {
      openSwitcher(message.tabs || [], message.accentColor || '#8B7CF6')
    }
  }

  if (message.type === Messages.TAB_SWITCHER_CLOSE) {
    closeSwitcher()
  }
})

// Ctrl+Q on the page itself also triggers it (user may prefer this over side panel shortcut)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q' && !swOpen) {
    e.preventDefault()
    chrome.runtime.sendMessage({
      type: Messages.TAB_SWITCHER_OPEN,
      screenWidth:  window.screen.width,
      screenHeight: window.screen.height,
    }).catch(() => {})
  }
}, true) // capture phase