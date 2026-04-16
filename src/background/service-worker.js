/**
 * Arc-like Extension — Background Service Worker
 * Brave / Chrome MV3 compatible.
 *
 * Key additions in this version:
 * - Pre-captures tab screenshots on every onActivated event (cached in memory)
 * - TAB_SWITCHER_OPEN relays to the active tab's content script (not a popup window)
 * - Popup window fallback when content script is unavailable (internal pages)
 */

import { Messages } from '@shared/messages.js';
import { urlsMatch } from '@shared/utils.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACE_COLORS = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#A78BFA','#FB923C'];
const SPACE_EMOJIS = ['🏠','💼','🎮','📚','🎨','✈️','🔬','💬'];
const MAX_CLOSED       = 20;
const MAX_ACCESS_ORDER = 100;

// ─── Screenshot Cache ─────────────────────────────────────────────────────────
// Pre-captured screenshots keyed by tab ID.
// captureVisibleTab() can ONLY capture the currently active tab, so we capture
// immediately whenever a tab becomes active and cache the result here.
// This map lives in service-worker memory — it resets when the SW is restarted
// by the browser (after idle), but repopulates quickly as the user navigates.

/** @type {Map<number, string>} tabId → JPEG data URL */
const tabScreenshots = new Map();

async function captureActiveTab(tabId) {
  try {
    // Small delay so the page has rendered before capture
    await new Promise(r => setTimeout(r, 600));
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 55 });
    tabScreenshots.set(tabId, dataUrl);
  } catch (_) {
    // Tab may be an internal page (brave://, chrome://) — silently ignore
  }
}

// ─── Application State ────────────────────────────────────────────────────────

let state = {
  spaces: [], activeSpaceId: '', tabs: [], favorites: [],
  pinnedUrls: [], folders: [], recentlyClosed: [],
  sidebarCollapsed: false, darkMode: 'auto',
};
let stateReady    = false;
let tabAccessOrder = [];

// ─── Persistence ──────────────────────────────────────────────────────────────

async function loadState() {
  const stored = await chrome.storage.local.get(['arcState']);

  if (stored.arcState?.spaces?.length > 0) {
    const saved = stored.arcState;

    // Migration: per-space pinnedUrls → global
    let globalPins = saved.pinnedUrls || [];
    const migratedSpaces = (saved.spaces || []).map((space) => {
      if (space.pinnedUrls?.length > 0 && globalPins.length === 0) {
        space.pinnedUrls.forEach((pin, i) => {
          if (!globalPins.find((p) => urlsMatch(p.url, pin.url))) {
            globalPins.push({ id: pin.id || crypto.randomUUID(), url: pin.url, title: pin.title || '', favIconUrl: pin.favIconUrl || '', order: i });
          }
        });
      }
      const { pinnedUrls: _, ...rest } = space;
      return rest;
    });

    state = {
      favorites: [], pinnedUrls: [], folders: [], recentlyClosed: [],
      sidebarCollapsed: false, darkMode: 'auto',
      ...saved, spaces: migratedSpaces, pinnedUrls: globalPins,
      folders: saved.folders || [], recentlyClosed: saved.recentlyClosed || [],
    };
    tabAccessOrder = saved.tabAccessOrder || [];
  } else {
    const homeSpace = { id: crypto.randomUUID(), name: 'Home', emoji: '🏠', color: SPACE_COLORS[0] };
    state = { ...state, spaces: [homeSpace], activeSpaceId: homeSpace.id };
  }

  const liveIds = new Set(state.tabs.map((t) => t.id));
  tabAccessOrder = tabAccessOrder.filter((id) => liveIds.has(id));
  const missingIds = state.tabs.filter((t) => !tabAccessOrder.includes(t.id)).sort((a, b) => b.openedAt - a.openedAt).map((t) => t.id);
  tabAccessOrder = [...missingIds, ...tabAccessOrder].slice(0, MAX_ACCESS_ORDER);
  stateReady = true;
}

async function saveState() {
  await chrome.storage.local.set({ arcState: { ...state, tabAccessOrder } });
  chrome.runtime.sendMessage({ type: Messages.STATE_UPDATED, state: { ...state, tabAccessOrder } }).catch(() => {});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInternalUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
         url.startsWith('brave://') || url === 'about:blank' || url === '';
}

function normalizeTab(t) {
  if (!t.id || t.id < 0) return null;
  const ex = state.tabs.find((s) => s.id === t.id);
  return {
    id: t.id, title: t.title || 'New Tab', url: t.url || t.pendingUrl || '',
    favIconUrl: t.favIconUrl || '', pinned: t.pinned || false,
    spaceId: ex?.spaceId || state.activeSpaceId || state.spaces[0]?.id || '',
    openedAt: ex?.openedAt || Date.now(), muted: t.mutedInfo?.muted || false, suspended: false,
  };
}

function updateTab(tabId, changes) {
  state = { ...state, tabs: state.tabs.map((t) => t.id === tabId ? { ...t, ...changes } : t) };
}

async function syncTabs() {
  const chromeTabs = await chrome.tabs.query({});
  const liveIds = new Set(chromeTabs.map((t) => t.id).filter(Boolean));
  state = { ...state, tabs: state.tabs.filter((t) => liveIds.has(t.id)) };
  tabAccessOrder = tabAccessOrder.filter((id) => liveIds.has(id));
  state = { ...state, folders: state.folders.map((f) => ({ ...f, tabIds: f.tabIds.filter((id) => liveIds.has(id)) })).filter((f) => f.tabIds.length > 0) };
  for (const ct of chromeTabs) {
    if (!ct.id) continue;
    const ex = state.tabs.find((t) => t.id === ct.id);
    if (ex) updateTab(ct.id, { title: ct.title || ex.title, url: ct.url || ex.url, favIconUrl: ct.favIconUrl ?? ex.favIconUrl, pinned: ct.pinned, muted: ct.mutedInfo?.muted || false });
    else { const n = normalizeTab(ct); if (n) state = { ...state, tabs: [...state.tabs, n] }; }
  }
}

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────

chrome.tabs.onCreated.addListener(async (tab) => {
  stateReady || (await loadState());
  const url = tab.pendingUrl || tab.url || '';
  if (url === 'chrome://newtab/' || url === 'chrome://new-tab-page/' || url === 'brave://newtab/' || url === chrome.runtime.getURL('newtab/index.html')) {
    try { await chrome.runtime.sendMessage({ type: Messages.OPEN_NEW_TAB_MODAL }); if (tab.id) await chrome.tabs.remove(tab.id); return; } catch (_) {}
  }
  const n = normalizeTab(tab);
  if (n) { state = { ...state, tabs: [...state.tabs.filter((t) => t.id !== tab.id), n] }; await saveState(); }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  stateReady || (await loadState());
  if (state.tabs.find((t) => t.id === tabId)) {
    const changes = {};
    if (changeInfo.title) changes.title = changeInfo.title;
    if (changeInfo.favIconUrl !== undefined) changes.favIconUrl = changeInfo.favIconUrl;
    if (tab.url) changes.url = tab.url;
    if (changeInfo.mutedInfo !== undefined) changes.muted = changeInfo.mutedInfo.muted;
    if (changeInfo.status === 'loading') changes.suspended = false;
    if (Object.keys(changes).length > 0) updateTab(tabId, changes);
    if (changeInfo.favIconUrl || changeInfo.title) {
      state = { ...state, pinnedUrls: state.pinnedUrls.map((pin) => urlsMatch(pin.url, tab.url || '') ? { ...pin, favIconUrl: changeInfo.favIconUrl || pin.favIconUrl, title: changeInfo.title || pin.title } : pin) };
    }
  } else {
    const n = normalizeTab(tab);
    if (n) state = { ...state, tabs: [...state.tabs, n] };
  }
  await saveState();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  stateReady || (await loadState());
  const closingTab = state.tabs.find((t) => t.id === tabId);
  if (closingTab && !isInternalUrl(closingTab.url)) {
    state = { ...state, recentlyClosed: [{ id: crypto.randomUUID(), title: closingTab.title, url: closingTab.url, favIconUrl: closingTab.favIconUrl, spaceId: closingTab.spaceId, closedAt: Date.now() }, ...state.recentlyClosed].slice(0, MAX_CLOSED) };
  }
  state = { ...state, tabs: state.tabs.filter((t) => t.id !== tabId) };
  tabAccessOrder = tabAccessOrder.filter((id) => id !== tabId);
  tabScreenshots.delete(tabId);
  state = { ...state, folders: state.folders.map((f) => ({ ...f, tabIds: f.tabIds.filter((id) => id !== tabId) })).filter((f) => f.tabIds.length > 0) };
  await saveState();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  stateReady || (await loadState());

  // Update MRU order
  tabAccessOrder = [tabId, ...tabAccessOrder.filter((id) => id !== tabId)].slice(0, MAX_ACCESS_ORDER);

  // Pre-capture screenshot of this tab for use in the tab switcher
  captureActiveTab(tabId);

  const activatedTab = state.tabs.find((t) => t.id === tabId);
  if (activatedTab && activatedTab.spaceId !== state.activeSpaceId) {
    state = { ...state, activeSpaceId: activatedTab.spaceId };
  }
  await saveState();
});

// ─── Commands ─────────────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (command === 'open-command-bar' && activeTab?.id) chrome.tabs.sendMessage(activeTab.id, { type: Messages.OPEN_COMMAND_BAR }).catch(() => {});
  if (command === 'duplicate-tab' && activeTab?.id) await chrome.tabs.duplicate(activeTab.id);
  if (command === 'toggle-sidebar') { stateReady || (await loadState()); state = { ...state, sidebarCollapsed: !state.sidebarCollapsed }; await saveState(); }
  if (command === 'new-tab-modal') chrome.runtime.sendMessage({ type: Messages.OPEN_NEW_TAB_MODAL }).catch(() => {});
});

// ─── Extension Action ─────────────────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => { if (tab.id) await chrome.sidePanel.open({ tabId: tab.id }); });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (stateReady) handleMessage(message).then(sendResponse);
  else loadState().then(() => handleMessage(message).then(sendResponse));
  return true;
});

// ─── Message Handler ──────────────────────────────────────────────────────────

async function handleMessage(message) {
  switch (message.type) {

    case Messages.GET_STATE: {
      await syncTabs(); await saveState();
      return { ...state, tabAccessOrder };
    }

    case Messages.GET_SETTINGS: {
      const stored = await chrome.storage.local.get('arcSettings');
      return stored.arcSettings || { searchEngine: 'brave', darkMode: 'auto', suspendAfterMinutes: 0 };
    }

    case Messages.UPDATE_SETTINGS: {
      const cur = (await chrome.storage.local.get('arcSettings')).arcSettings || {};
      const upd = { ...cur, ...message.settings };
      await chrome.storage.local.set({ arcSettings: upd });
      if (message.settings.darkMode !== undefined) { state = { ...state, darkMode: message.settings.darkMode }; await saveState(); }
      return upd;
    }

    case Messages.SET_DARK_MODE: {
      state = { ...state, darkMode: message.darkMode }; await saveState(); return state;
    }

    // ── Tab Switcher ──────────────────────────────────────────────────────────

    case Messages.TAB_SWITCHER_OPEN: {
      // Build MRU tab list with cached screenshots and space info
      const mruTabs = [];
      for (const id of tabAccessOrder) {
        const t = state.tabs.find((t) => t.id === id);
        if (t && t.url && !isInternalUrl(t.url)) {
          const space = state.spaces.find((s) => s.id === t.spaceId);
          mruTabs.push({
            ...t,
            screenshot: tabScreenshots.get(id) || null,
            spaceEmoji: space?.emoji || '',
            spaceColor: space?.color || '#8B7CF6',
          });
          if (mruTabs.length >= 5) break;
        }
      }

      if (mruTabs.length === 0) return null;

      const accentColor = state.spaces.find((s) => s.id === state.activeSpaceId)?.color || '#8B7CF6';

      // Try forwarding to the active tab's content script (renders overlay ON the page)
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) throw new Error('no active tab');
        await chrome.tabs.sendMessage(activeTab.id, {
          type: Messages.TAB_SWITCHER_OPEN,
          tabs: mruTabs,
          accentColor,
        });
      } catch (_) {
        // Content script not available (internal/extension page) — fall back to popup window
        const W = 520, H = 240;
        const sw = message.screenWidth  || 1440;
        const sh = message.screenHeight || 900;
        await chrome.windows.create({
          url:     chrome.runtime.getURL('tabswitcher.html'),
          type:    'popup',
          width:   W,
          height:  H,
          left:    Math.round((sw - W) / 2),
          top:     Math.round(sh * 0.65),   // bottom area like Arc
          focused: true,
        }).catch(() => {});
      }
      return null;
    }

    case Messages.TAB_SWITCHER_CLOSE: {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) chrome.tabs.sendMessage(activeTab.id, { type: Messages.TAB_SWITCHER_CLOSE }).catch(() => {});
      return null;
    }

    // ── Spaces ────────────────────────────────────────────────────────────────

    case Messages.CREATE_SPACE: {
      const idx = state.spaces.length % SPACE_COLORS.length;
      const s = { id: crypto.randomUUID(), name: message.name || 'New Space', emoji: message.emoji || SPACE_EMOJIS[idx], color: message.color || SPACE_COLORS[idx] };
      state = { ...state, spaces: [...state.spaces, s] }; await saveState(); return state;
    }

    case Messages.SWITCH_SPACE: {
      state = { ...state, activeSpaceId: message.spaceId }; await saveState();
      // FIX: only activate existing tab, never create blank tab
      const spaceTabs = state.tabs.filter((t) => t.spaceId === message.spaceId && !isInternalUrl(t.url));
      if (spaceTabs.length > 0) {
        const mostRecent = [...spaceTabs].sort((a, b) => b.openedAt - a.openedAt)[0];
        await chrome.tabs.update(mostRecent.id, { active: true }).catch(() => {});
      }
      return state;
    }

    case Messages.RENAME_SPACE: {
      state = { ...state, spaces: state.spaces.map((s) => s.id === message.spaceId ? { ...s, name: message.name || s.name, emoji: message.emoji || s.emoji, color: message.color || s.color } : s) };
      await saveState(); return state;
    }

    case Messages.DELETE_SPACE: {
      if (state.spaces.length <= 1) return state;
      const remaining = state.spaces.filter((s) => s.id !== message.spaceId);
      const newActive = state.activeSpaceId === message.spaceId ? remaining[0].id : state.activeSpaceId;
      await Promise.all(state.tabs.filter((t) => t.spaceId === message.spaceId).map((t) => chrome.tabs.remove(t.id).catch(() => {})));
      state = { ...state, spaces: remaining, activeSpaceId: newActive, tabs: state.tabs.filter((t) => t.spaceId !== message.spaceId), folders: state.folders.filter((f) => f.spaceId !== message.spaceId) };
      await saveState(); return state;
    }

    // ── Tabs ──────────────────────────────────────────────────────────────────

    case Messages.CLOSE_TAB:         { await chrome.tabs.remove(message.tabId).catch(() => {}); return null; }
    case Messages.DUPLICATE_TAB:     { await chrome.tabs.duplicate(message.tabId).catch(() => {}); return null; }
    case Messages.CREATE_TAB_WITH_URL: {
      const url = /^https?:\/\//i.test(message.url) ? message.url : `https://${message.url}`;
      await chrome.tabs.create({ url }); return null;
    }

    case Messages.MUTE_TAB: {
      const tab = state.tabs.find((t) => t.id === message.tabId);
      if (tab) { await chrome.tabs.update(message.tabId, { muted: !tab.muted }).catch(() => {}); updateTab(message.tabId, { muted: !tab.muted }); await saveState(); }
      return state;
    }

    case Messages.MOVE_TAB_TO_SPACE: {
      updateTab(message.tabId, { spaceId: message.spaceId });
      state = { ...state, folders: state.folders.map((f) => ({ ...f, tabIds: f.tabIds.filter((id) => id !== message.tabId) })).filter((f) => f.tabIds.length > 0) };
      await saveState(); return state;
    }

    case Messages.REORDER_TABS: {
      const now = Date.now();
      state = { ...state, tabs: state.tabs.map((tab) => { const idx = message.tabIds.indexOf(tab.id); return idx === -1 ? tab : { ...tab, openedAt: now - idx }; }) };
      await saveState(); return state;
    }

    case Messages.SUSPEND_TAB: {
      await chrome.tabs.discard(message.tabId).catch(() => {});
      updateTab(message.tabId, { suspended: true }); await saveState(); return state;
    }

    case Messages.SUSPEND_SPACE: {
      const [at] = await chrome.tabs.query({ active: true, currentWindow: true });
      await Promise.all(state.tabs.filter((t) => t.spaceId === message.spaceId && t.id !== at?.id && !isInternalUrl(t.url)).map((t) => chrome.tabs.discard(t.id).then(() => updateTab(t.id, { suspended: true })).catch(() => {})));
      await saveState(); return state;
    }

    // ── Favorites ─────────────────────────────────────────────────────────────

    case Messages.ADD_FAVORITE: {
      if (state.favorites.find((f) => urlsMatch(f.url, message.url))) return state;
      state = { ...state, favorites: [...state.favorites, { id: crypto.randomUUID(), url: message.url, title: message.title || '', favIconUrl: message.favIconUrl || '', order: state.favorites.length }] };
      await saveState(); return state;
    }
    case Messages.REMOVE_FAVORITE: { state = { ...state, favorites: state.favorites.filter((f) => f.id !== message.id) }; await saveState(); return state; }
    case Messages.REORDER_FAVORITES: { state = { ...state, favorites: message.ids.map((id, i) => { const f = state.favorites.find((f) => f.id === id); return f ? { ...f, order: i } : null; }).filter(Boolean) }; await saveState(); return state; }

    // ── Pins ──────────────────────────────────────────────────────────────────

    case Messages.PIN_URL: {
      if (state.pinnedUrls.find((p) => urlsMatch(p.url, message.url))) return state;
      state = { ...state, pinnedUrls: [...state.pinnedUrls, { id: crypto.randomUUID(), url: message.url, title: message.title || '', favIconUrl: message.favIconUrl || '', order: state.pinnedUrls.length }] };
      await saveState(); return state;
    }
    case Messages.UNPIN_URL: { state = { ...state, pinnedUrls: state.pinnedUrls.filter((p) => p.id !== message.pinId) }; await saveState(); return state; }
    case Messages.REORDER_PINS: { state = { ...state, pinnedUrls: message.ids.map((id, i) => { const p = state.pinnedUrls.find((p) => p.id === id); return p ? { ...p, order: i } : null; }).filter(Boolean) }; await saveState(); return state; }

    // ── Folders ───────────────────────────────────────────────────────────────

    case Messages.CREATE_FOLDER: {
      const folder = { id: crypto.randomUUID(), name: message.name || 'New Folder', tabIds: message.tabIds || [], collapsed: false, spaceId: message.spaceId || state.activeSpaceId, order: state.folders.filter((f) => f.spaceId === (message.spaceId || state.activeSpaceId)).length };
      state = { ...state, folders: [...state.folders, folder] }; await saveState(); return state;
    }
    case Messages.DELETE_FOLDER: { state = { ...state, folders: state.folders.filter((f) => f.id !== message.folderId) }; await saveState(); return state; }
    case Messages.RENAME_FOLDER: { state = { ...state, folders: state.folders.map((f) => f.id === message.folderId ? { ...f, name: message.name } : f) }; await saveState(); return state; }
    case Messages.TOGGLE_FOLDER: { state = { ...state, folders: state.folders.map((f) => f.id === message.folderId ? { ...f, collapsed: !f.collapsed } : f) }; await saveState(); return state; }
    case Messages.MOVE_TAB_TO_FOLDER: {
      let f = state.folders.map((fl) => ({ ...fl, tabIds: fl.tabIds.filter((id) => id !== message.tabId) }));
      f = f.map((fl) => fl.id === message.folderId ? { ...fl, tabIds: [...fl.tabIds, message.tabId] } : fl).filter((fl) => fl.tabIds.length > 0);
      state = { ...state, folders: f }; await saveState(); return state;
    }
    case Messages.REMOVE_TAB_FROM_FOLDER: {
      state = { ...state, folders: state.folders.map((f) => ({ ...f, tabIds: f.tabIds.filter((id) => id !== message.tabId) })).filter((f) => f.tabIds.length > 0) };
      await saveState(); return state;
    }
    case Messages.REORDER_FOLDERS: {
      if (Array.isArray(message.folderOrders)) state = { ...state, folders: state.folders.map((f) => { if (f.spaceId !== message.spaceId) return f; const i = message.folderOrders.indexOf(f.id); return i !== -1 ? { ...f, order: i } : f; }) };
      await saveState(); return state;
    }

    // ── Recently closed ───────────────────────────────────────────────────────

    case Messages.RESTORE_CLOSED_TAB: {
      const entry = state.recentlyClosed.find((e) => e.id === message.entryId);
      if (entry) { await chrome.tabs.create({ url: entry.url }); state = { ...state, recentlyClosed: state.recentlyClosed.filter((e) => e.id !== message.entryId) }; await saveState(); }
      return state;
    }
    case Messages.CLEAR_CLOSED_TABS: { state = { ...state, recentlyClosed: [] }; await saveState(); return state; }

    // ── Sessions ──────────────────────────────────────────────────────────────

    case Messages.GET_SESSIONS: { const s = await chrome.storage.local.get('arcSessions'); return s.arcSessions || []; }
    case Messages.SAVE_SESSION: {
      const s = await chrome.storage.local.get('arcSessions');
      const sessions = s.arcSessions || [];
      const session = { id: crypto.randomUUID(), name: message.name || `Session ${new Date().toLocaleDateString()}`, savedAt: Date.now(), spaces: state.spaces.map((sp) => ({ ...sp, tabs: state.tabs.filter((t) => t.spaceId === sp.id && !isInternalUrl(t.url)).map((t) => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl })) })), activeSpaceId: state.activeSpaceId, pinnedUrls: state.pinnedUrls, favorites: state.favorites };
      const updated = [session, ...sessions].slice(0, 20);
      await chrome.storage.local.set({ arcSessions: updated }); return updated;
    }
    case Messages.RESTORE_SESSION: {
      const s = await chrome.storage.local.get('arcSessions');
      const session = (s.arcSessions || []).find((s) => s.id === message.sessionId);
      if (session) for (const sp of session.spaces) for (const t of sp.tabs) await chrome.tabs.create({ url: t.url, active: false }).catch(() => {});
      return state;
    }
    case Messages.DELETE_SESSION: {
      const s = await chrome.storage.local.get('arcSessions');
      const sessions = (s.arcSessions || []).filter((s) => s.id !== message.sessionId);
      await chrome.storage.local.set({ arcSessions: sessions }); return sessions;
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────

    case Messages.SET_SIDEBAR_COLLAPSED: { state = { ...state, sidebarCollapsed: message.collapsed }; await saveState(); return state; }

    default: return null;
  }
}

loadState();