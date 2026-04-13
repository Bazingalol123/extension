import { create } from 'zustand'
import { Messages } from '@shared/messages.js'

/**
 * Send a message to the background service worker.
 * @param {string} type - Message type from Messages enum
 * @param {object} payload - Additional data to include
 */
const sendMessage = (type, payload = {}) =>
  chrome.runtime.sendMessage({ type, ...payload })

/**
 * Normalize raw state from background, ensuring all fields have defaults.
 * @param {object} rawState - State received from background
 */
const parseState = (rawState) => ({
  spaces: rawState.spaces ?? [],
  activeSpaceId: rawState.activeSpaceId ?? '',
  tabs: rawState.tabs ?? [],
  favorites: rawState.favorites ?? [],
  pinnedUrls: rawState.pinnedUrls ?? [],
  folders: rawState.folders ?? [],
  sidebarCollapsed: rawState.sidebarCollapsed ?? false,
  tabAccessOrder: rawState.tabAccessOrder ?? [],
  loading: false,
})

const useStore = create((set, get) => ({
  // State from background
  spaces: [],
  activeSpaceId: '',
  tabs: [],
  favorites: [],
  pinnedUrls: [],
  folders: [],
  sidebarCollapsed: false,
  tabAccessOrder: [],

  // Local UI state
  loading: true,
  activeTabId: null,

  // ─── Actions ─────────────────────────────────────────────

  load: async () => {
    try {
      const state = await sendMessage(Messages.GET_STATE)
      if (state) set(parseState(state))

      // Track current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (activeTab?.id) set({ activeTabId: activeTab.id })

      // Listen for state updates from background
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === Messages.STATE_UPDATED && msg.state) {
          set(parseState(msg.state))
        }
      })

      // Track tab activation
      chrome.tabs.onActivated.addListener(({ tabId }) => set({ activeTabId: tabId }))

      // Track tab updates (title, favicon)
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.id) {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tab.id
                ? {
                    ...t,
                    title: tab.title || t.title,
                    favIconUrl: tab.favIconUrl ?? t.favIconUrl,
                  }
                : t
            ),
          }))
        }
      })
    } catch (err) {
      console.error('Arc:', err)
      set({ loading: false })
    }
  },

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

  closeTab: async (tabId) => {
    set((state) => ({ tabs: state.tabs.filter((t) => t.id !== tabId) }))
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

  activateTab: (tabId) => {
    chrome.tabs.update(tabId, { active: true })
    set({ activeTabId: tabId })
  },

  activateFavoriteUrl: (url) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.url === url)
    if (existing) {
      chrome.tabs.update(existing.id, { active: true })
      set({ activeTabId: existing.id })
    } else {
      chrome.tabs.create({ url })
    }
  },

  addFavorite: async (tab) => {
    const state = await sendMessage(Messages.ADD_FAVORITE, {
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    })
    if (state) set(parseState(state))
  },

  removeFavorite: async (id) => {
    const state = await sendMessage(Messages.REMOVE_FAVORITE, { id })
    if (state) set(parseState(state))
  },

  reorderFavorites: async (ids) => {
    set((state) => ({
      favorites: ids
        .map((id, index) => {
          const fav = state.favorites.find((f) => f.id === id)
          return fav ? { ...fav, order: index } : null
        })
        .filter((f) => f !== null),
    }))
    await sendMessage(Messages.REORDER_FAVORITES, { ids })
  },

  setSidebarCollapsed: async (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    await sendMessage(Messages.SET_SIDEBAR_COLLAPSED, { collapsed })
  },

  pinUrl: async (tab) => {
    const state = await sendMessage(Messages.PIN_URL, {
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    })
    if (state) set(parseState(state))
  },

  unpinUrl: async (pinId) => {
    const state = await sendMessage(Messages.UNPIN_URL, { pinId })
    if (state) set(parseState(state))
  },

  reorderPins: async (ids) => {
    set((state) => ({
      pinnedUrls: ids
        .map((id, index) => {
          const pin = state.pinnedUrls.find((p) => p.id === id)
          return pin ? { ...pin, order: index } : null
        })
        .filter((p) => p !== null),
    }))
    await sendMessage(Messages.REORDER_PINS, { ids })
  },

  reorderTabs: async (tabIds) => {
    // Optimistically update openedAt so sort order matches the drag result
    const now = Date.now()
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        const idx = tabIds.indexOf(tab.id)
        if (idx === -1) return tab
        // Higher openedAt = appears first (sort is descending)
        return { ...tab, openedAt: now - idx }
      }),
    }))
    await sendMessage(Messages.REORDER_TABS, { tabIds })
  },

  // ─── Folder Actions ─────────────────────────────────────

  createFolder: async (spaceId, name, tabIds) => {
    const state = await sendMessage(Messages.CREATE_FOLDER, { spaceId, name, tabIds })
    if (state) set(parseState(state))
  },

  deleteFolder: async (folderId) => {
    const state = await sendMessage(Messages.DELETE_FOLDER, { folderId })
    if (state) set(parseState(state))
  },

  renameFolder: async (folderId, name) => {
    const state = await sendMessage(Messages.RENAME_FOLDER, { folderId, name })
    if (state) set(parseState(state))
  },

  toggleFolder: async (folderId) => {
    // Optimistic toggle
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
      ),
    }))
    await sendMessage(Messages.TOGGLE_FOLDER, { folderId })
  },

  moveTabToFolder: async (tabId, folderId) => {
    const state = await sendMessage(Messages.MOVE_TAB_TO_FOLDER, { tabId, folderId })
    if (state) set(parseState(state))
  },

  removeTabFromFolder: async (tabId) => {
    const state = await sendMessage(Messages.REMOVE_TAB_FROM_FOLDER, { tabId })
    if (state) set(parseState(state))
  },

  reorderFolders: async (spaceId, folderOrders) => {
    await sendMessage(Messages.REORDER_FOLDERS, { spaceId, folderOrders })
  },
}))

export default useStore
