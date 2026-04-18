/**
 * @typedef {Object} Space
 * @property {string} id - Unique space identifier
 * @property {string} name - Display name (e.g. "Home", "Work")
 * @property {string} emoji - Emoji icon for the space
 * @property {string} color - Hex color code (e.g. "#8B7CF6")
 * @property {PinnedUrl[]} [pinnedUrls] - DEPRECATED: URLs pinned to this space (kept for migration only)
 */

/**
 * @typedef {Object} PinnedUrl
 * @property {string} id - Unique identifier
 * @property {string} url - The pinned URL
 * @property {string} title - Display title
 * @property {string} favIconUrl - Favicon URL
 * @property {number} order - Sort position
 */

/**
 * @typedef {Object} Tab
 * @property {number} id - Chrome tab ID
 * @property {string} title - Tab title
 * @property {string} url - Tab URL
 * @property {string} favIconUrl - Favicon URL
 * @property {boolean} pinned - Whether tab is pinned in Chrome
 * @property {string} spaceId - ID of the space this tab belongs to
 * @property {number} openedAt - Timestamp when tab was opened
 * @property {boolean} muted - Whether tab audio is muted
 * @property {number} [windowId] - Chrome window ID that owns this tab (Phase 1 — may be missing on legacy state, backfilled by syncTabs)
 */

/**
 * @typedef {Object} Favorite
 * @property {string} id - Bookmark node id (from chrome.bookmarks)
 * @property {string} url - Favorite URL
 * @property {string} title - Display title (editable — this is how rename works)
 * @property {string} parentId - Parent bookmark folder id (root or a folder under root)
 * @property {number} order - Index within parent folder
 * @property {string} favIconUrl - Favicon from our faviconCache (bookmarks API has no favicons)
 */

/**
 * @typedef {Object} FavoriteFolder
 * @property {string} id - Bookmark folder node id
 * @property {string} title - Folder title (editable)
 * @property {string} parentId - Always the favorites root in v1 (no nested folders yet in UI)
 * @property {number} order - Index within parent
 */

/**
 * @typedef {Object} ArcState
 * @property {Space[]} spaces - All workspaces
 * @property {string} activeSpaceId - Currently active space ID
 * @property {Tab[]} tabs - All tracked tabs
 * @property {Favorite[]} favorites - Global favorites
 * @property {PinnedUrl[]} pinnedUrls - Global pinned URLs (across all spaces)
 * @property {boolean} sidebarCollapsed - Whether sidebar is collapsed to icon rail
 */

// This file is documentation-only. No runtime exports needed.
// Import types in JSDoc with: /** @type {import('./types').ArcState} */