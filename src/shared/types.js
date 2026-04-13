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
 */

/**
 * @typedef {Object} Favorite
 * @property {string} id - Unique favorite identifier
 * @property {string} url - Favorite URL
 * @property {string} title - Display title
 * @property {string} favIcon - Favicon URL
 */

/**
 * @typedef {Object} Folder
 * @property {string} id - Unique folder ID
 * @property {string} name - Folder display name
 * @property {string} spaceId - Which space this folder belongs to
 * @property {number[]} tabIds - Ordered array of tab IDs in this folder
 * @property {boolean} collapsed - Whether the folder is collapsed
 * @property {number} order - Sort order among tabs/folders in the space
 */

/**
 * @typedef {Object} ArcState
 * @property {Space[]} spaces - All workspaces
 * @property {string} activeSpaceId - Currently active space ID
 * @property {Tab[]} tabs - All tracked tabs
 * @property {Favorite[]} favorites - Global favorites
 * @property {PinnedUrl[]} pinnedUrls - Global pinned URLs (across all spaces)
 * @property {Folder[]} folders - Collapsible tab folders
 * @property {boolean} sidebarCollapsed - Whether sidebar is collapsed to icon rail
 */

// This file is documentation-only. No runtime exports needed.
// Import types in JSDoc with: /** @type {import('./types').ArcState} */
