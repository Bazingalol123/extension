/**
 * Arc-like Browser Extension — Background Service Worker
 *
 * Manages extension state (spaces, tabs, favorites, pinned URLs, sidebar),
 * persists it to chrome.storage.local, and handles messages
 * from the sidepanel, commandbar, and newtab pages.
 */

import { Messages } from '@shared/messages.js';
import { urlsMatch } from '@shared/utils.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Palette of colors cycled through when creating new spaces */
const SPACE_COLORS = [
  '#8B7CF6', '#F87171', '#34D399', '#FBBF24',
  '#60A5FA', '#F472B6', '#A78BFA', '#FB923C',
];

/** Default emojis cycled through when creating new spaces */
const SPACE_EMOJIS = ['🏠', '💼', '🎮', '📚', '🎨', '✈️', '🔬', '💬'];

// ─── Global State ─────────────────────────────────────────────────────────────

/**
 * Application state — the single source of truth for the extension.
 * Shape mirrors the `ArcState` type from shared/types.js.
 * @type {{ spaces: Array, activeSpaceId: string, tabs: Array, favorites: Array, pinnedUrls: Array, folders: Array, sidebarCollapsed: boolean }}
 */
let state = {
  spaces: [],
  activeSpaceId: '',
  tabs: [],
  favorites: [],
  pinnedUrls: [],
  folders: [],
  sidebarCollapsed: false,
};

/** Whether state has been loaded from storage at least once */
let stateReady = false;

/**
 * In-memory only: tab IDs ordered by most recently accessed first.
 * Not persisted to chrome.storage to avoid excessive writes.
 * Rebuilt from `tabs` sorted by `openedAt` on startup.
 * @type {number[]}
 */
let tabAccessOrder = [];

// ─── State Persistence ────────────────────────────────────────────────────────

/**
 * Loads state from `chrome.storage.local`.
 * If no saved state exists (or spaces are empty), creates a default "Home" space.
 * Also performs migration from per-space pinnedUrls to global pinnedUrls.
 * Sets `stateReady = true` once complete.
 */
async function loadState() {
  const stored = await chrome.storage.local.get('arcState');

  if (stored.arcState?.spaces?.length > 0) {
    const saved = stored.arcState;
    state = {
      favorites: [],
      pinnedUrls: [],
      folders: [],
      sidebarCollapsed: false,
      ...saved,
      // Ensure every space has a pinnedUrls array (backward compat)
      spaces: (saved.spaces || []).map((space) => ({
        ...space,
        pinnedUrls: space.pinnedUrls ?? [],
      })),
    };

    // ─── Migration: per-space pinnedUrls → global pinnedUrls ───────────
    const hasPerSpacePins = state.spaces.some((s) => s.pinnedUrls && s.pinnedUrls.length > 0);

    if (hasPerSpacePins) {
      // Merge all per-space pinnedUrls into global, dedup by URL
      const seenUrls = new Set((state.pinnedUrls || []).map((p) => p.url));
      const migratedPins = [...(state.pinnedUrls || [])];

      for (const space of state.spaces) {
        for (const pin of (space.pinnedUrls || [])) {
          if (!seenUrls.has(pin.url)) {
            seenUrls.add(pin.url);
            migratedPins.push({
              id: pin.id || crypto.randomUUID(),
              url: pin.url,
              title: pin.title || '',
              favIconUrl: pin.favIconUrl || '',
              order: migratedPins.length,
            });
          }
        }
      }

      state.pinnedUrls = migratedPins;

      // Clear per-space pinnedUrls
      state.spaces = state.spaces.map((space) => ({
        ...space,
        pinnedUrls: [],
      }));

      await saveState();
    }
  } else {
    // First run — create a default "Home" space
    const homeSpace = {
      id: crypto.randomUUID(),
      name: 'Home',
      emoji: '🏠',
      color: '#8B7CF6',
      pinnedUrls: [],
    };
    state = {
      spaces: [homeSpace],
      activeSpaceId: homeSpace.id,
      tabs: [],
      favorites: [],
      pinnedUrls: [],
      folders: [],
      sidebarCollapsed: false,
    };
    await saveState();
  }

  // Ensure folders array exists (backward compat)
  if (!state.folders) {
    state.folders = [];
  }

  // Rebuild tabAccessOrder from tabs sorted by openedAt (most recent first)
  tabAccessOrder = [...state.tabs]
    .sort((a, b) => b.openedAt - a.openedAt)
    .map((t) => t.id);

  stateReady = true;
}

/**
 * Persists the current state to `chrome.storage.local` and broadcasts
 * a `STATE_UPDATED` message to all extension contexts (sidepanel, etc.).
 */
async function saveState() {
  await chrome.storage.local.set({ arcState: state });
  chrome.runtime.sendMessage({
    type: Messages.STATE_UPDATED,
    state: { ...state, tabAccessOrder },
  }).catch(() => {});
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Returns `true` if the given URL is an internal browser page
 * (chrome://, chrome-extension://, about:blank, empty, or falsy).
 * @param {string|undefined} url
 * @returns {boolean}
 */
function isInternalUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url === 'about:blank' ||
    url === ''
  );
}

/**
 * Converts a native `chrome.tabs.Tab` object into our internal tab shape.
 * Preserves `spaceId` and `openedAt` if the tab is already tracked in state.
 * Returns `null` for invalid tabs (no id or negative id).
 * @param {chrome.tabs.Tab} chromeTab
 * @returns {object|null}
 */
function normalizeTab(chromeTab) {
  if (!chromeTab.id || chromeTab.id < 0) return null;

  const existingTab = state.tabs.find((t) => t.id === chromeTab.id);

  return {
    id: chromeTab.id,
    title: chromeTab.title || 'New Tab',
    url: chromeTab.url || chromeTab.pendingUrl || '',
    favIconUrl: chromeTab.favIconUrl || '',
    pinned: chromeTab.pinned || false,
    spaceId:
      existingTab?.spaceId ||
      state.activeSpaceId ||
      state.spaces[0]?.id ||
      '',
    openedAt: existingTab?.openedAt || Date.now(),
    muted: chromeTab.mutedInfo?.muted || false,
  };
}

/**
 * Immutably updates a tab in state by merging `changes` into the tab with the given `tabId`.
 * @param {number} tabId
 * @param {object} changes — partial tab properties to merge
 */
function updateTab(tabId, changes) {
  state = {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, ...changes } : tab
    ),
  };
}

/**
 * Synchronises internal tab state with actual Chrome tabs.
 * Removes stale entries and adds/updates tabs that Chrome knows about.
 */
async function syncTabs() {
  const chromeTabs = await chrome.tabs.query({});
  const liveTabIds = new Set(chromeTabs.map((t) => t.id).filter((id) => id != null));

  // Remove tabs from state that no longer exist in Chrome
  state = { ...state, tabs: state.tabs.filter((t) => liveTabIds.has(t.id)) };

  // Clean up tabAccessOrder for stale tabs
  tabAccessOrder = tabAccessOrder.filter((id) => liveTabIds.has(id));

  // Update or add each live tab
  for (const chromeTab of chromeTabs) {
    if (!chromeTab.id) continue;

    const existing = state.tabs.find((t) => t.id === chromeTab.id);

    if (existing) {
      updateTab(chromeTab.id, {
        title: chromeTab.title || existing.title,
        url: chromeTab.url || existing.url,
        favIconUrl: chromeTab.favIconUrl ?? existing.favIconUrl,
        pinned: chromeTab.pinned,
        muted: chromeTab.mutedInfo?.muted || false,
      });
    } else {
      const normalized = normalizeTab(chromeTab);
      if (normalized) {
        state = { ...state, tabs: [...state.tabs, normalized] };
      }
    }
  }
}

// ─── Tab Lifecycle Listeners ──────────────────────────────────────────────────

/**
 * When a new tab is created, normalise it and add to state.
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  stateReady || (await loadState());

  // Detect blank new-tab pages and try to redirect to the side panel modal
  const pendingOrUrl = tab.pendingUrl || tab.url || '';
  const newTabUrl = chrome.runtime.getURL('newtab/index.html');
  if (
    pendingOrUrl === 'chrome://newtab/' ||
    pendingOrUrl === 'chrome://new-tab-page/' ||
    pendingOrUrl === newTabUrl
  ) {
    // Try sending a message to the side panel — if it's open it will respond
    try {
      await chrome.runtime.sendMessage({ type: Messages.OPEN_NEW_TAB_MODAL });
      // Side panel received the message — close the blank tab
      if (tab.id) {
        await chrome.tabs.remove(tab.id);
      }
      return; // Don't add this tab to state
    } catch (_) {
      // No listener (side panel not open) — fall through and keep the tab
    }
  }

  const normalized = normalizeTab(tab);
  if (normalized) {
    state = {
      ...state,
      tabs: [...state.tabs.filter((t) => t.id !== tab.id), normalized],
    };
    await saveState();
  }
});

/**
 * When a tab is updated (navigation, title change, favicon change, mute toggle),
 * update the matching tab in state. Also propagate favicon/title changes
 * to any matching global pinned URL entries.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  stateReady || (await loadState());

  if (state.tabs.find((t) => t.id === tabId)) {
    // Build a partial update from the change info
    const changes = {};
    if (changeInfo.title) changes.title = changeInfo.title;
    if (changeInfo.favIconUrl !== undefined) changes.favIconUrl = changeInfo.favIconUrl;
    if (tab.url) changes.url = tab.url;
    if (changeInfo.mutedInfo !== undefined) changes.muted = changeInfo.mutedInfo.muted;

    if (Object.keys(changes).length > 0) {
      updateTab(tabId, changes);
    }

    // Propagate favicon / title updates to matching global pinned URLs
    if (changeInfo.favIconUrl || changeInfo.title) {
      const currentUrl = tab.url || '';
      state = {
        ...state,
        pinnedUrls: state.pinnedUrls.map((pin) =>
          urlsMatch(pin.url, currentUrl)
            ? {
                ...pin,
                favIconUrl: changeInfo.favIconUrl || pin.favIconUrl,
                title: changeInfo.title || pin.title,
              }
            : pin
        ),
      };
    }
  } else {
    // Tab not yet tracked — add it
    const normalized = normalizeTab(tab);
    if (normalized) {
      state = { ...state, tabs: [...state.tabs, normalized] };
    }
  }

  await saveState();
});

/**
 * When a tab is closed, remove it from state.
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  stateReady || (await loadState());
  state = { ...state, tabs: state.tabs.filter((t) => t.id !== tabId) };
  // Remove from in-memory access order
  tabAccessOrder = tabAccessOrder.filter((id) => id !== tabId);

  // Remove tab from any folder's tabIds; auto-delete empty folders
  state = {
    ...state,
    folders: state.folders
      .map((folder) => ({
        ...folder,
        tabIds: folder.tabIds.filter((id) => id !== tabId),
      }))
      .filter((folder) => folder.tabIds.length > 0),
  };

  await saveState();
});

/**
 * When the user activates a tab, update `activeSpaceId` to match
 * the tab's assigned space (if different from current).
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  stateReady || (await loadState());

  // Move activated tab to front of access order
  tabAccessOrder = [tabId, ...tabAccessOrder.filter((id) => id !== tabId)];

  const activatedTab = state.tabs.find((t) => t.id === tabId);
  if (activatedTab && activatedTab.spaceId !== state.activeSpaceId) {
    state = { ...state, activeSpaceId: activatedTab.spaceId };
    await saveState();
  } else {
    // Still broadcast so sidepanel gets updated tabAccessOrder
    chrome.runtime.sendMessage({
      type: Messages.STATE_UPDATED,
      state: { ...state, tabAccessOrder },
    }).catch(() => {});
  }
});

// ─── Keyboard Command Handler ─────────────────────────────────────────────────

/**
 * Handles keyboard shortcuts registered in the manifest `commands` section.
 * - `open-command-bar`: sends a message to the active tab to open the command bar
 * - `duplicate-tab`: duplicates the currently active tab
 * - `toggle-sidebar`: toggles the sidebar collapsed state
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (command === 'open-command-bar' && activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, { type: Messages.OPEN_COMMAND_BAR }).catch(() => {});
  }

  if (command === 'duplicate-tab' && activeTab?.id) {
    await chrome.tabs.duplicate(activeTab.id);
  }

  if (command === 'toggle-sidebar') {
    stateReady || (await loadState());
    state = { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    await saveState();
  }
});

// ─── Extension Action & Side Panel ────────────────────────────────────────────

/** Open the side panel when the extension icon is clicked */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

/** Configure side panel to open on action click by default */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message Router ───────────────────────────────────────────────────────────

/**
 * Central message listener.
 * Ensures state is loaded, then delegates to `handleMessage`.
 * Returns `true` to indicate the response will be sent asynchronously.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (stateReady) {
    handleMessage(message).then(sendResponse);
  } else {
    loadState().then(() => handleMessage(message).then(sendResponse));
  }
  return true; // keep the message channel open for async response
});

/**
 * Handles all incoming extension messages by type.
 * @param {object} message — must contain a `type` property
 * @returns {Promise<object|null>} — the updated state, or null
 */
async function handleMessage(message) {
  switch (message.type) {
    // ── State ──────────────────────────────────────────────────────────────

    case Messages.GET_STATE: {
      await syncTabs();
      await saveState();
      return { ...state, tabAccessOrder };
    }

    // ── Spaces ─────────────────────────────────────────────────────────────

    case Messages.CREATE_SPACE: {
      const index = state.spaces.length % SPACE_COLORS.length;
      const newSpace = {
        id: crypto.randomUUID(),
        name: message.name || 'New Space',
        emoji: message.emoji || SPACE_EMOJIS[index],
        color: message.color || SPACE_COLORS[index],
        pinnedUrls: [],
      };
      state = { ...state, spaces: [...state.spaces, newSpace] };
      await saveState();
      return state;
    }

    case Messages.SWITCH_SPACE: {
      state = { ...state, activeSpaceId: message.spaceId };
      await saveState();

      // Activate the most recently opened non-internal tab in the target space
      const spaceTabs = state.tabs.filter(
        (t) => t.spaceId === message.spaceId && !isInternalUrl(t.url)
      );

      if (spaceTabs.length > 0) {
        const mostRecent = [...spaceTabs].sort((a, b) => b.openedAt - a.openedAt)[0];
        await chrome.tabs.update(mostRecent.id, { active: true }).catch(() => {});
      } else {
        // No tabs in this space — open a new one
        await chrome.tabs.create({});
      }

      return state;
    }

    case Messages.RENAME_SPACE: {
      state = {
        ...state,
        spaces: state.spaces.map((space) =>
          space.id === message.spaceId
            ? {
                ...space,
                name: message.name || space.name,
                emoji: message.emoji || space.emoji,
                color: message.color || space.color,
              }
            : space
        ),
      };
      await saveState();
      return state;
    }

    case Messages.DELETE_SPACE: {
      if (state.spaces.length <= 1) return state; // must keep at least one space

      const remainingSpaces = state.spaces.filter((s) => s.id !== message.spaceId);
      const newActiveId =
        state.activeSpaceId === message.spaceId
          ? remainingSpaces[0].id
          : state.activeSpaceId;

      state = {
        ...state,
        spaces: remainingSpaces,
        activeSpaceId: newActiveId,
        // Reassign orphaned tabs to the new active space
        tabs: state.tabs.map((tab) =>
          tab.spaceId === message.spaceId ? { ...tab, spaceId: newActiveId } : tab
        ),
      };
      await saveState();
      return state;
    }

    // ── Pinned URLs (Global) ────────────────────────────────────────────────

    case Messages.PIN_URL: {
      const { url, title, favIconUrl } = message;

      // Don't pin if URL is already pinned
      if (state.pinnedUrls.some((p) => urlsMatch(p.url, url))) {
        return state;
      }

      const pinnedEntry = {
        id: crypto.randomUUID(),
        url,
        title,
        favIconUrl,
        order: state.pinnedUrls.length,
      };

      state = {
        ...state,
        pinnedUrls: [...state.pinnedUrls, pinnedEntry],
      };
      await saveState();
      return state;
    }

    case Messages.UNPIN_URL: {
      const { pinId } = message;
      state = {
        ...state,
        pinnedUrls: state.pinnedUrls.filter((p) => p.id !== pinId),
      };
      await saveState();
      return state;
    }

    case Messages.REORDER_PINS: {
      const { ids } = message;
      state = {
        ...state,
        pinnedUrls: ids
          .map((id, index) => {
            const pin = state.pinnedUrls.find((p) => p.id === id);
            return pin ? { ...pin, order: index } : null;
          })
          .filter((pin) => pin !== null),
      };
      await saveState();
      return state;
    }

    // ── Tab Actions ────────────────────────────────────────────────────────

    case Messages.CLOSE_TAB: {
      await chrome.tabs.remove(message.tabId).catch(() => {});
      return null;
    }

    case Messages.DUPLICATE_TAB: {
      await chrome.tabs.duplicate(message.tabId).catch(() => {});
      return null;
    }

    case Messages.MUTE_TAB: {
      const tabId = message.tabId;
      const tab = state.tabs.find((t) => t.id === tabId);
      const shouldMute = !(tab?.muted);
      await chrome.tabs.update(tabId, { muted: shouldMute }).catch(() => {});
      updateTab(tabId, { muted: shouldMute });
      await saveState();
      return state;
    }

    case Messages.MOVE_TAB_TO_SPACE: {
      state = {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === message.tabId ? { ...tab, spaceId: message.spaceId } : tab
        ),
      };
      await saveState();
      return state;
    }

    case Messages.REORDER_TABS: {
      const { tabIds } = message;
      if (!Array.isArray(tabIds)) return state;

      // Update openedAt so the sort order (descending by openedAt) matches the new order
      const now = Date.now();
      state = {
        ...state,
        tabs: state.tabs.map((tab) => {
          const idx = tabIds.indexOf(tab.id);
          if (idx === -1) return tab;
          return { ...tab, openedAt: now - idx };
        }),
      };

      // Also reorder actual Chrome tabs to match the new visual order
      try {
        for (let i = 0; i < tabIds.length; i++) {
          await chrome.tabs.move(tabIds[i], { index: i }).catch(() => {});
        }
      } catch (_) {
        // Best-effort: Chrome may reject moves for pinned tabs, etc.
      }

      await saveState();
      return state;
    }

    // ── Favorites ──────────────────────────────────────────────────────────

    case Messages.ADD_FAVORITE: {
      // Don't add duplicates by URL
      if (state.favorites.find((f) => f.url === message.url)) return state;

      const favorite = {
        id: crypto.randomUUID(),
        url: message.url,
        title: message.title,
        favIconUrl: message.favIconUrl,
        order: state.favorites.length,
      };
      state = { ...state, favorites: [...state.favorites, favorite] };
      await saveState();
      return state;
    }

    case Messages.REMOVE_FAVORITE: {
      state = {
        ...state,
        favorites: state.favorites.filter((f) => f.id !== message.id),
      };
      await saveState();
      return state;
    }

    case Messages.REORDER_FAVORITES: {
      const ids = message.ids;
      state = {
        ...state,
        favorites: ids
          .map((id, index) => {
            const fav = state.favorites.find((f) => f.id === id);
            return fav ? { ...fav, order: index } : null;
          })
          .filter((f) => f !== null),
      };
      await saveState();
      return state;
    }

    // ── Folders ─────────────────────────────────────────────────────────────

    case Messages.CREATE_FOLDER: {
      const { spaceId, name, tabIds } = message;
      const newFolder = {
        id: 'folder-' + Date.now(),
        name: name || 'New Folder',
        spaceId,
        tabIds: tabIds || [],
        collapsed: false,
        order: state.folders.filter((f) => f.spaceId === spaceId).length,
      };

      // Remove those tabIds from any existing folders
      let updatedFolders = state.folders.map((folder) => ({
        ...folder,
        tabIds: folder.tabIds.filter((id) => !(tabIds || []).includes(id)),
      }));

      // Remove now-empty folders (except the new one we're about to add)
      updatedFolders = updatedFolders.filter((f) => f.tabIds.length > 0);

      state = { ...state, folders: [...updatedFolders, newFolder] };
      await saveState();
      return state;
    }

    case Messages.DELETE_FOLDER: {
      const { folderId } = message;
      state = {
        ...state,
        folders: state.folders.filter((f) => f.id !== folderId),
      };
      await saveState();
      return state;
    }

    case Messages.RENAME_FOLDER: {
      const { folderId, name } = message;
      state = {
        ...state,
        folders: state.folders.map((f) =>
          f.id === folderId ? { ...f, name } : f
        ),
      };
      await saveState();
      return state;
    }

    case Messages.TOGGLE_FOLDER: {
      const { folderId } = message;
      state = {
        ...state,
        folders: state.folders.map((f) =>
          f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
        ),
      };
      await saveState();
      return state;
    }

    case Messages.MOVE_TAB_TO_FOLDER: {
      const { tabId, folderId } = message;
      // Remove tab from any current folder
      let updatedFolders = state.folders.map((folder) => ({
        ...folder,
        tabIds: folder.tabIds.filter((id) => id !== tabId),
      }));

      // Add to target folder
      updatedFolders = updatedFolders.map((folder) =>
        folder.id === folderId
          ? { ...folder, tabIds: [...folder.tabIds, tabId] }
          : folder
      );

      // Auto-delete empty folders
      updatedFolders = updatedFolders.filter((f) => f.tabIds.length > 0);

      state = { ...state, folders: updatedFolders };
      await saveState();
      return state;
    }

    case Messages.REMOVE_TAB_FROM_FOLDER: {
      const { tabId } = message;
      let updatedFolders = state.folders.map((folder) => ({
        ...folder,
        tabIds: folder.tabIds.filter((id) => id !== tabId),
      }));

      // Auto-delete empty folders
      updatedFolders = updatedFolders.filter((f) => f.tabIds.length > 0);

      state = { ...state, folders: updatedFolders };
      await saveState();
      return state;
    }

    case Messages.REORDER_FOLDERS: {
      const { spaceId, folderOrders } = message;
      // folderOrders is an array of { id, order } or just an array of folder IDs
      if (Array.isArray(folderOrders)) {
        state = {
          ...state,
          folders: state.folders.map((f) => {
            if (f.spaceId !== spaceId) return f;
            const idx = folderOrders.indexOf(f.id);
            return idx !== -1 ? { ...f, order: idx } : f;
          }),
        };
      }
      await saveState();
      return state;
    }

    // ── Sidebar ────────────────────────────────────────────────────────────

    case Messages.SET_SIDEBAR_COLLAPSED: {
      state = { ...state, sidebarCollapsed: message.collapsed };
      await saveState();
      return state;
    }

    // ── Unknown ────────────────────────────────────────────────────────────

    default:
      return null;
  }
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/** Load state immediately on service worker startup */
loadState();
