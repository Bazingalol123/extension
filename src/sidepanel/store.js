import { create } from 'zustand'
import { Messages } from '@shared/messages.js'
import { urlsMatch } from '@shared/utils.js'
/**
 * Send a message to the background service worker and return the response.
 * @param {string} type
 * @param {object} [payload]
 * @returns {Promise<object|null>}
 */
async function sendMessage(type, payload = {}) {
  try {
    return await chrome.runtime.sendMessage({ type, ...payload })
  } catch (err) {
    console.warn('Arc store message failed:', type, err)
    return null
  }
}

/**
 * Parse raw state from the service worker into the Zustand shape.
 */
function parseState(rawState) {
  if (!rawState) return {}
  return {
    spaces:          rawState.spaces         ?? [],
    activeSpaceId:   rawState.activeSpaceId  ?? '',
    tabs:            rawState.tabs           ?? [],
    favorites:       rawState.favorites      ?? [],
    pinnedUrls:      rawState.pinnedUrls     ?? [],
    favoriteFolders:     rawState.favoriteFolders     ?? [],
    favoriteFolderState: rawState.favoriteFolderState ?? {},
    bookmarksFailed:     rawState.bookmarksFailed     ?? false,
    recentlyClosed:  rawState.recentlyClosed ?? [],
    sidebarCollapsed: rawState.sidebarCollapsed ?? false,
    tabAccessOrder:  rawState.tabAccessOrder  ?? [],
    darkMode:        rawState.darkMode        ?? 'auto',
    favoriteOwnerships: rawState.favoriteOwnerships ?? [],
  }
}

const useStore = create((set, get) => ({
 // ── State ──────────────────────────────────────────────────────────────────
  spaces:           [],
  activeSpaceId:    '',
  tabs:             [],
  favorites:        [],
  pinnedUrls:       [],
  recentlyClosed:   [],
  sidebarCollapsed: false,
  tabAccessOrder:   [],
  activeTabId:      null,
  darkMode:         'auto',
  loading:          true,
  sessions:         [],
  myWindowId:       null,
  favoriteFolders:     [],
  favoriteFolderState: {},
  bookmarksFailed:     false,
  favoriteOwnerships: [],

  setMyWindowId: (id) => set({ myWindowId: id }),

  // ── Load ──────────────────────────────────────────────────────────────────
  load: async () => {
    try {
      const rawState = await sendMessage(Messages.GET_STATE)
      if (rawState) set({ ...parseState(rawState), loading: false })

      // Load sessions separately
      const sessions = await sendMessage(Messages.GET_SESSIONS)
      if (sessions) set({ sessions })

      // Sync active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (activeTab?.id) set({ activeTabId: activeTab.id })

      // Listen for state updates pushed from the service worker
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === Messages.STATE_UPDATED && msg.state) {
          set(parseState(msg.state))
          // Sync active tab from updated tabs list
          chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
            if (t?.id) set({ activeTabId: t.id })
          })
          // Also keep favicon + title in sync
          set((state) => {
            if (!msg.state.tabs) return {}
            return {
              tabs: state.tabs.map((t) => {
                const updated = msg.state.tabs.find((u) => u.id === t.id)
                return updated
                  ? { ...t, title: updated.title || t.title, favIconUrl: updated.favIconUrl ?? t.favIconUrl }
                  : t
              }),
            }
          })
        }
      })
    } catch (err) {
      console.error('Arc:', err)
      set({ loading: false })
    }
  },

  // ── Spaces ────────────────────────────────────────────────────────────────
  createSpace: async (name, emoji, color) => {
    const state = await sendMessage(Messages.CREATE_SPACE, { name, emoji, color })
    if (state) set(parseState(state))
  },

  switchSpace: async (spaceId) => {
    set({ activeSpaceId: spaceId })
    const state = await sendMessage(Messages.SWITCH_SPACE, { spaceId })
    if (state) set(parseState(state))
  },

  renameSpace: async (spaceId, name, emoji, color) => {
    const state = await sendMessage(Messages.RENAME_SPACE, { spaceId, name, emoji, color })
    if (state) set(parseState(state))
  },

  deleteSpace: async (spaceId) => {
    const state = await sendMessage(Messages.DELETE_SPACE, { spaceId })
    if (state) set(parseState(state))
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  activateTab: (tabId) => {
    chrome.tabs.update(tabId, { active: true })
    set({ activeTabId: tabId })
  },

  closeTab: async (tabId) => {
    set((s) => ({ tabs: s.tabs.filter((t) => t.id !== tabId) }))
    await sendMessage(Messages.CLOSE_TAB, { tabId })
  },

  duplicateTab: async (tabId) => {
    await sendMessage(Messages.DUPLICATE_TAB, { tabId })
  },

  muteTab: async (tabId) => {
    const state = await sendMessage(Messages.MUTE_TAB, { tabId })
    if (state) set(parseState(state))
  },

  moveTabToSpace: async (tabId, spaceId) => {
    const state = await sendMessage(Messages.MOVE_TAB_TO_SPACE, { tabId, spaceId })
    if (state) set(parseState(state))
  },

  reorderTabs: async (tabIds) => {
    const now = Date.now()
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        const idx = tabIds.indexOf(tab.id)
        if (idx === -1) return tab
        return { ...tab, openedAt: now - idx }
      }),
    }))
    await sendMessage(Messages.REORDER_TABS, { tabIds })
  },

  suspendTab: async (tabId) => {
    const state = await sendMessage(Messages.SUSPEND_TAB, { tabId })
    if (state) set(parseState(state))
  },

  suspendSpace: async (spaceId) => {
    const state = await sendMessage(Messages.SUSPEND_SPACE, { spaceId })
    if (state) set(parseState(state))
  },

  // ── Favorites ─────────────────────────────────────────────────────────────


  addFavorite: async (tab, parentId) => {
    const state = await sendMessage(Messages.ADD_FAVORITE, {
      url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl,
      ...(parentId ? { parentId } : {}),
    })
    if (state) set(parseState(state))
  },

  removeFavorite: async (id) => {
    const state = await sendMessage(Messages.REMOVE_FAVORITE, { id })
    if (state) set(parseState(state))
  },

  reorderFavorites: async (ids) => {
    set((s) => ({
      favorites: ids.map((id, index) => {
        const fav = s.favorites.find((f) => f.id === id)
        return fav ? { ...fav, order: index } : null
      }).filter(Boolean),
    }))
    await sendMessage(Messages.REORDER_FAVORITES, { ids })
  },

  renameFavorite: async (id, title) => {
    const state = await sendMessage(Messages.RENAME_FAVORITE, { id, title })
    if (state) set(parseState(state))
  },

  moveFavorite: async (id, parentId, index) => {
    const state = await sendMessage(Messages.MOVE_FAVORITE, { id, parentId, index })
    if (state) set(parseState(state))
  },

  createFavoriteFolder: async (title) => {
    const state = await sendMessage(Messages.CREATE_FAVORITE_FOLDER, { title: title || 'New folder' })
    if (state) set(parseState(state))
  },

  deleteFavoriteFolder: async (id) => {
    const state = await sendMessage(Messages.DELETE_FAVORITE_FOLDER, { id })
    if (state) set(parseState(state))
  },

  renameFavoriteFolder: async (id, title) => {
    const state = await sendMessage(Messages.RENAME_FAVORITE_FOLDER, { id, title })
    if (state) set(parseState(state))
  },

  toggleFavoriteFolder: async (id) => {
    // Optimistic local toggle for snappy UI
    set((s) => ({
      favoriteFolderState: {
        ...s.favoriteFolderState,
        [id]: !s.favoriteFolderState?.[id],
      },
    }))
    const state = await sendMessage(Messages.TOGGLE_FAVORITE_FOLDER, { id })
    if (state) set(parseState(state))
  },

  

  activateFavorite: async (favId) => {
    const { myWindowId } = get()
    if (myWindowId == null) return
    await sendMessage(Messages.ACTIVATE_FAVORITE, { favId, windowId: myWindowId })
  },

  deactivateFavorite: async (favId) => {
    const { myWindowId } = get()
    if (myWindowId == null) return
    const state = await sendMessage(Messages.DEACTIVATE_FAVORITE, { favId, windowId: myWindowId })
    if (state) set(parseState(state))
  },

  resetFavoriteDrift: async (favId) => {
    const { myWindowId } = get()
    if (myWindowId == null) return
    const state = await sendMessage(Messages.RESET_FAVORITE_DRIFT, { favId, windowId: myWindowId })
    if (state) set(parseState(state))
  },

  // ── Pinned URLs ───────────────────────────────────────────────────────────
  pinUrl: async (tab) => {
    const state = await sendMessage(Messages.PIN_URL, {
      url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl,
    })
    if (state) set(parseState(state))
  },

  unpinUrl: async (pinId) => {
    const state = await sendMessage(Messages.UNPIN_URL, { pinId })
    if (state) set(parseState(state))
  },

  reorderPins: async (ids) => {
    set((s) => ({
      pinnedUrls: ids.map((id, index) => {
        const pin = s.pinnedUrls.find((p) => p.id === id)
        return pin ? { ...pin, order: index } : null
      }).filter(Boolean),
    }))
    await sendMessage(Messages.REORDER_PINS, { ids })
  },

 

  // ── Sidebar ───────────────────────────────────────────────────────────────
  setSidebarCollapsed: async (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    await sendMessage(Messages.SET_SIDEBAR_COLLAPSED, { collapsed })
  },

  // ── Dark Mode ─────────────────────────────────────────────────────────────
  setDarkMode: async (darkMode) => {
    set({ darkMode })
    // Apply to DOM immediately
    if (darkMode === 'auto') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', darkMode)
    }
    await sendMessage(Messages.SET_DARK_MODE, { darkMode })
  },

  // ── Recently Closed ───────────────────────────────────────────────────────
  restoreClosedTab: async (entryId) => {
    const state = await sendMessage(Messages.RESTORE_CLOSED_TAB, { entryId })
    if (state) set(parseState(state))
  },

  clearClosedTabs: async () => {
    const state = await sendMessage(Messages.CLEAR_CLOSED_TABS)
    if (state) set(parseState(state))
  },

  // ── Sessions ──────────────────────────────────────────────────────────────
  saveSession: async (name) => {
    const sessions = await sendMessage(Messages.SAVE_SESSION, { name })
    if (sessions) set({ sessions })
    return sessions
  },

  restoreSession: async (sessionId) => {
    await sendMessage(Messages.RESTORE_SESSION, { sessionId })
  },

  deleteSession: async (sessionId) => {
    const sessions = await sendMessage(Messages.DELETE_SESSION, { sessionId })
    if (sessions) set({ sessions })
  },

  reloadSessions: async () => {
    const sessions = await sendMessage(Messages.GET_SESSIONS)
    if (sessions) set({ sessions })
    return sessions
  },
}))

export default useStore