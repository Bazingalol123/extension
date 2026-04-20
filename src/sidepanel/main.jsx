import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import useStore from './store'
import './sidepanel.css'

// Phase 1: detect which browser window this sidepanel instance belongs to.
// The SW sets ?windowId=N on new windows via sidePanel.setOptions.
// Fallback: chrome.windows.getCurrent() (for pre-existing windows at install,
// or any race where setOptions hasn't applied yet).
async function detectMyWindowId() {
  const fromUrl = new URLSearchParams(location.search).get('windowId')
  if (fromUrl && !Number.isNaN(Number(fromUrl))) return Number(fromUrl)
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