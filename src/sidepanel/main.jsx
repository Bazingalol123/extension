import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import useStore from './store'
import './sidepanel.css'

// ── Phase 1: Multi-Window support ─────────────────────────────────────────────
// Each sidepanel instance belongs to exactly one browser window.
// We learn which one via a URL query param set by the SW on windows.onCreated,
// with a fallback to chrome.windows.getCurrent() when the param is missing
// (first-run, existing windows at install time, or any setOptions race).

async function detectMyWindowId() {
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('windowId')
  if (fromUrl && !Number.isNaN(Number(fromUrl))) {
    return Number(fromUrl)
  }
  try {
    const w = await chrome.windows.getCurrent()
    return w?.id ?? null
  } catch {
    return null
  }
}

detectMyWindowId().then((id) => {
  if (id != null) useStore.getState().setMyWindowId(id)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)