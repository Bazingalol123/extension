export const Messages = {
  // ── State ─────────────────────────────────────────────────────────────────
  GET_STATE: 'GET_STATE',
  STATE_UPDATED: 'STATE_UPDATED',

  // ── Spaces ────────────────────────────────────────────────────────────────
  CREATE_SPACE: 'CREATE_SPACE',
  SWITCH_SPACE: 'SWITCH_SPACE',
  RENAME_SPACE: 'RENAME_SPACE',
  DELETE_SPACE: 'DELETE_SPACE',

  // ── Tabs ──────────────────────────────────────────────────────────────────
  PIN_TAB: 'PIN_TAB',
  UNPIN_TAB: 'UNPIN_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  MOVE_TAB_TO_SPACE: 'MOVE_TAB_TO_SPACE',
  DUPLICATE_TAB: 'DUPLICATE_TAB',
  MUTE_TAB: 'MUTE_TAB',
  REORDER_TABS: 'REORDER_TABS',
  SUSPEND_TAB: 'SUSPEND_TAB',
  SUSPEND_SPACE: 'SUSPEND_SPACE',
  ACTIVATE_TAB: 'ACTIVATE_TAB',
  CREATE_TAB_WITH_URL: 'CREATE_TAB_WITH_URL',

  // ── Command bar & modals ──────────────────────────────────────────────────
  OPEN_COMMAND_BAR: 'OPEN_COMMAND_BAR',
  OPEN_NEW_TAB_MODAL: 'OPEN_NEW_TAB_MODAL',
  NEW_TAB_MODAL_OPEN: 'NEW_TAB_MODAL_OPEN',

  // ── Favorites ─────────────────────────────────────────────────────────────
  ADD_FAVORITE: 'ADD_FAVORITE',
  REMOVE_FAVORITE: 'REMOVE_FAVORITE',
  REORDER_FAVORITES: 'REORDER_FAVORITES',
  RENAME_FAVORITE: 'RENAME_FAVORITE',
  MOVE_FAVORITE: 'MOVE_FAVORITE',
  SET_FAVORITE_URL_TO_CURRENT: 'SET_FAVORITE_URL_TO_CURRENT',  // Drop 4
  ACTIVATE_FAVORITE: 'ACTIVATE_FAVORITE',
  DEACTIVATE_FAVORITE: 'DEACTIVATE_FAVORITE',
  RESET_FAVORITE_DRIFT: 'RESET_FAVORITE_DRIFT',

  // ── Favorite folders ──────────────────────────────────────────────────────
  CREATE_FAVORITE_FOLDER: 'CREATE_FAVORITE_FOLDER',
  DELETE_FAVORITE_FOLDER: 'DELETE_FAVORITE_FOLDER',
  RENAME_FAVORITE_FOLDER: 'RENAME_FAVORITE_FOLDER',
  TOGGLE_FAVORITE_FOLDER: 'TOGGLE_FAVORITE_FOLDER',
  MOVE_FAVORITE_FOLDER: 'MOVE_FAVORITE_FOLDER',  // Drop 4: drag folder into folder / reorder

  // ── Pins ──────────────────────────────────────────────────────────────────
  PIN_URL: 'PIN_URL',
  UNPIN_URL: 'UNPIN_URL',
  REORDER_PINS: 'REORDER_PINS',
  SET_PIN_URL_TO_CURRENT: 'SET_PIN_URL_TO_CURRENT',  // Drop 4
  ACTIVATE_PIN: 'ACTIVATE_PIN',
  DEACTIVATE_PIN: 'DEACTIVATE_PIN',
  RESET_PIN_DRIFT: 'RESET_PIN_DRIFT',

  // ── Sidebar ───────────────────────────────────────────────────────────────
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  SET_SIDEBAR_COLLAPSED: 'SET_SIDEBAR_COLLAPSED',

  // ── Recently closed ───────────────────────────────────────────────────────
  RESTORE_CLOSED_TAB: 'RESTORE_CLOSED_TAB',
  CLEAR_CLOSED_TABS: 'CLEAR_CLOSED_TABS',

  // ── Sessions ──────────────────────────────────────────────────────────────
  SAVE_SESSION: 'SAVE_SESSION',
  RESTORE_SESSION: 'RESTORE_SESSION',
  DELETE_SESSION: 'DELETE_SESSION',
  GET_SESSIONS: 'GET_SESSIONS',

  // ── Settings ──────────────────────────────────────────────────────────────
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_DARK_MODE: 'SET_DARK_MODE',

  // ── Tab switcher ──────────────────────────────────────────────────────────
  TAB_SWITCHER_OPEN: 'TAB_SWITCHER_OPEN',
  TAB_SWITCHER_CLOSE: 'TAB_SWITCHER_CLOSE',
  TAB_SWITCHER_GET_SCREENSHOTS: 'TAB_SWITCHER_GET_SCREENSHOTS',
  TAB_SWITCHER_CAPTURE_CURRENT: 'TAB_SWITCHER_CAPTURE_CURRENT',
}