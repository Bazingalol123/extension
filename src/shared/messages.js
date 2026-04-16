/**
 * Message types for communication between background, sidepanel, commandbar, and newtab.
 */
export const Messages = {
  // ── State ────────────────────────────────────────────────────────────────
  GET_STATE: 'GET_STATE',
  STATE_UPDATED: 'STATE_UPDATED',

  // ── Spaces ───────────────────────────────────────────────────────────────
  CREATE_SPACE: 'CREATE_SPACE',
  SWITCH_SPACE: 'SWITCH_SPACE',
  RENAME_SPACE: 'RENAME_SPACE',
  DELETE_SPACE: 'DELETE_SPACE',

  // ── Tabs ─────────────────────────────────────────────────────────────────
  PIN_TAB: 'PIN_TAB',
  UNPIN_TAB: 'UNPIN_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  MOVE_TAB_TO_SPACE: 'MOVE_TAB_TO_SPACE',
  DUPLICATE_TAB: 'DUPLICATE_TAB',
  MUTE_TAB: 'MUTE_TAB',
  REORDER_TABS: 'REORDER_TABS',
  SUSPEND_TAB: 'SUSPEND_TAB',
  SUSPEND_SPACE: 'SUSPEND_SPACE',

  // ── Command bar ──────────────────────────────────────────────────────────
  OPEN_COMMAND_BAR: 'OPEN_COMMAND_BAR',

  // ── New tab modal ────────────────────────────────────────────────────────
  OPEN_NEW_TAB_MODAL: 'OPEN_NEW_TAB_MODAL',
  CREATE_TAB_WITH_URL: 'CREATE_TAB_WITH_URL',

  // ── Favorites ────────────────────────────────────────────────────────────
  ADD_FAVORITE: 'ADD_FAVORITE',
  REMOVE_FAVORITE: 'REMOVE_FAVORITE',
  REORDER_FAVORITES: 'REORDER_FAVORITES',

  // ── Pinned URLs (global) ─────────────────────────────────────────────────
  PIN_URL: 'PIN_URL',
  UNPIN_URL: 'UNPIN_URL',
  REORDER_PINS: 'REORDER_PINS',

  // ── Folders ──────────────────────────────────────────────────────────────
  CREATE_FOLDER: 'CREATE_FOLDER',
  DELETE_FOLDER: 'DELETE_FOLDER',
  RENAME_FOLDER: 'RENAME_FOLDER',
  TOGGLE_FOLDER: 'TOGGLE_FOLDER',
  MOVE_TAB_TO_FOLDER: 'MOVE_TAB_TO_FOLDER',
  REMOVE_TAB_FROM_FOLDER: 'REMOVE_TAB_FROM_FOLDER',
  REORDER_FOLDERS: 'REORDER_FOLDERS',

  // ── Sidebar ──────────────────────────────────────────────────────────────
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  SET_SIDEBAR_COLLAPSED: 'SET_SIDEBAR_COLLAPSED',

  // ── Recently closed ──────────────────────────────────────────────────────
  RESTORE_CLOSED_TAB: 'RESTORE_CLOSED_TAB',
  CLEAR_CLOSED_TABS: 'CLEAR_CLOSED_TABS',

  // ── Sessions ─────────────────────────────────────────────────────────────
  SAVE_SESSION: 'SAVE_SESSION',
  RESTORE_SESSION: 'RESTORE_SESSION',
  DELETE_SESSION: 'DELETE_SESSION',
  GET_SESSIONS: 'GET_SESSIONS',

  // ── Settings ─────────────────────────────────────────────────────────────
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',

  // ── Dark mode ────────────────────────────────────────────────────────────
  SET_DARK_MODE: 'SET_DARK_MODE',

  // ── Tab Switcher (content script overlay) ────────────────────────────────
  // Sent: side panel → background → active tab content script
  TAB_SWITCHER_OPEN:    'TAB_SWITCHER_OPEN',    // { tabs: MRUTab[], selectedIdx: number }
  TAB_SWITCHER_NEXT:    'TAB_SWITCHER_NEXT',    // advance selection by 1
  TAB_SWITCHER_PREV:    'TAB_SWITCHER_PREV',    // retreat selection by 1
  TAB_SWITCHER_CONFIRM: 'TAB_SWITCHER_CONFIRM', // activate selected tab, close overlay
  TAB_SWITCHER_CLOSE:   'TAB_SWITCHER_CLOSE',   // cancel without switching
}