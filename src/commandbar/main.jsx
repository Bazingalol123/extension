import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Messages } from '@shared/messages.js'
import CommandBar from './CommandBar.jsx'
import CSS_STRING from './commandbar.css?inline'

/**
 * Command bar content script.
 *
 * Injected into every page. Creates a shadow DOM host and renders a
 * React-powered Spotlight-style overlay for searching tabs, history,
 * and navigating. Uses shadow DOM to avoid CSS conflicts with the host page.
 */

let host = null   // outer <div> on documentElement
let shadow = null  // shadow root
let root = null    // React root
let isOpen = false // visibility flag

/**
 * Read the active space's accent color from chrome.storage.local.
 * Falls back to the default purple (#8B7CF6).
 * @returns {Promise<string>}
 */
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

/**
 * One-time setup: create the shadow DOM host, inject styles, and prepare
 * the React root. Idempotent — skips if already initialized.
 */
function ensureHost() {
  if (host) return

  // Create host element on documentElement (not body — survives SPA navigations)
  host = document.createElement('div')
  host.id = 'arc-cmdbar-host'
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;'
  document.documentElement.appendChild(host)

  // Attach shadow DOM
  shadow = host.attachShadow({ mode: 'open' })

  // Inject styles into shadow DOM
  const style = document.createElement('style')
  style.textContent = CSS_STRING
  shadow.appendChild(style)

  // Create React mount container inside shadow
  const container = document.createElement('div')
  container.style.cssText =
    'position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;'
  shadow.appendChild(container)

  root = createRoot(container)
}

/**
 * Wrapper component that enables pointer events on the overlay content.
 */
const CommandBarWrapper = ({ accentColor, onClose }) => (
  <div style={{ pointerEvents: 'all' }}>
    <CommandBar accentColor={accentColor} onClose={onClose} />
  </div>
)

/**
 * Open the command bar. Fetches accent color, creates the host if needed,
 * and renders the CommandBar into the shadow DOM.
 */
async function openCommandBar() {
  if (isOpen) return

  isOpen = true
  ensureHost()

  const accentColor = await getAccentColor()

  const handleClose = () => {
    isOpen = false
    // Render empty fragment to unmount CommandBar
    root?.render(<></>)
    if (host) host.style.pointerEvents = 'none'
  }

  if (host) host.style.pointerEvents = 'auto'

  root?.render(
    <StrictMode>
      <CommandBarWrapper accentColor={accentColor} onClose={handleClose} />
    </StrictMode>
  )
}

/**
 * Close the command bar by rendering an empty fragment and resetting state.
 */
function closeCommandBar() {
  isOpen = false
  root?.render(<></>)
  if (host) host.style.pointerEvents = 'none'
}

/**
 * Toggle the command bar open/closed.
 */
function toggleCommandBar() {
  if (isOpen) {
    closeCommandBar()
  } else {
    openCommandBar()
  }
}

/* ── Message listener: background sends OPEN_COMMAND_BAR ── */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === Messages.OPEN_COMMAND_BAR) {
    toggleCommandBar()
  }
})

/* ── Keyboard shortcut: Ctrl+Space toggles the bar ── */
document.addEventListener(
  'keydown',
  (evt) => {
    if (evt.ctrlKey && evt.code === 'Space' && !evt.shiftKey && !evt.altKey && !evt.metaKey) {
      evt.preventDefault()
      evt.stopPropagation()
      toggleCommandBar()
    }
  },
  { capture: true }
)
