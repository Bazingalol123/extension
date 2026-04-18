/**
 * Bookmarks adapter — wraps chrome.bookmarks for Arc UX favorites.
 *
 * Responsibilities:
 *   1. Find-or-create the "My Favorites" folder under "Other Bookmarks"
 *   2. Read that subtree into a flat {favorites, folders} shape for the UI
 *   3. Debounce bookmark events into a single callback
 *   4. Maintain a favicon cache (bookmarks API doesn't store favicons)
 *
 * Side-effects: event listeners attach at module load. Exactly one set per SW lifetime.
 */

const FAVORITES_FOLDER_NAME = 'My Favorites'
const OTHER_BOOKMARKS_ID    = '2'  // Chrome convention
const DEBOUNCE_MS           = 100
const MAX_FAVICON_CACHE     = 500

// ─── Root folder: find or create ─────────────────────────────────────────────

/**
 * Validate the saved root id, or search by name, or create new.
 * Returns the validated/created folder id.
 * @param {string|null} existingId
 * @returns {Promise<string>}
 */
export async function ensureFavoritesRoot(existingId) {
  // Validate existing id
  if (existingId) {
    try {
      const [node] = await chrome.bookmarks.get(existingId)
      if (node && !node.url && node.title === FAVORITES_FOLDER_NAME) {
        return existingId
      }
    } catch (_) { /* missing — fall through */ }
  }
  // Search under Other Bookmarks
  try {
    const children = await chrome.bookmarks.getChildren(OTHER_BOOKMARKS_ID)
    const match = children.find((n) => !n.url && n.title === FAVORITES_FOLDER_NAME)
    if (match) return match.id
  } catch (_) { /* fall through */ }
  // Create
  const created = await chrome.bookmarks.create({
    parentId: OTHER_BOOKMARKS_ID,
    title:    FAVORITES_FOLDER_NAME,
  })
  return created.id
}

// ─── Subtree → flat arrays ───────────────────────────────────────────────────

/**
 * Walk the favorites subtree. Returns:
 *   favorites: all url-bearing bookmarks (flattened, from any depth)
 *   folders:   only depth-0 folders (direct children of root) — v1 UI shows one level
 *
 * Favicons are filled from the provided faviconCache map.
 *
 * @param {string} rootId
 * @param {Object<string,string>} faviconCache
 * @returns {Promise<{favorites: Array, folders: Array}>}
 */
export async function readFavoritesTree(rootId, faviconCache = {}) {
  const favorites = []
  const folders   = []

  let tree
  try {
    const result = await chrome.bookmarks.getSubTree(rootId)
    tree = result?.[0]
  } catch (_) {
    return { favorites, folders }
  }
  if (!tree?.children) return { favorites, folders }

  function walk(node, depth) {
    if (!node.children) return
    node.children.forEach((child, index) => {
      if (child.url) {
        if (child.url.startsWith('javascript:')) return  // skip bookmarklets
        favorites.push({
          id:         child.id,
          url:        child.url,
          title:      child.title || '',
          parentId:   child.parentId,
          order:      index,
          favIconUrl: faviconCache[child.url] || '',
        })
      } else {
        if (depth === 0) {
          folders.push({
            id:       child.id,
            title:    child.title || '',
            parentId: child.parentId,
            order:    index,
          })
        }
        walk(child, depth + 1)
      }
    })
  }
  walk(tree, 0)
  return { favorites, folders }
}

// ─── Debounced change callback ───────────────────────────────────────────────

let _onChange     = null
let _importing    = false
let _debounceT    = null

/** Register a callback invoked (debounced) on any bookmark change. */
export function setBookmarkChangeCallback(cb) { _onChange = cb }

function scheduleRebuild() {
  if (_importing) return
  clearTimeout(_debounceT)
  _debounceT = setTimeout(() => {
    if (_onChange) {
      try { _onChange() } catch (e) { console.warn('Arc bookmark callback error:', e) }
    }
  }, DEBOUNCE_MS)
}

// Listeners — safe to attach at module level, fires at most once per SW lifetime
chrome.bookmarks.onCreated.addListener(scheduleRebuild)
chrome.bookmarks.onRemoved.addListener(scheduleRebuild)
chrome.bookmarks.onChanged.addListener(scheduleRebuild)
chrome.bookmarks.onMoved.addListener(scheduleRebuild)
chrome.bookmarks.onChildrenReordered.addListener(scheduleRebuild)
chrome.bookmarks.onImportBegan.addListener(() => { _importing = true })
chrome.bookmarks.onImportEnded.addListener(() => {
  _importing = false
  scheduleRebuild()
})

// ─── Favicon cache (mutates in place) ────────────────────────────────────────

/**
 * Insert or update a favicon. Evicts oldest when over MAX.
 * @param {Object<string,string>} faviconCache
 * @param {string[]} faviconCacheKeys
 * @param {string} url
 * @param {string} icon
 */
export function cacheFavicon(faviconCache, faviconCacheKeys, url, icon) {
  if (!url || !icon) return
  if (faviconCache[url] === icon) return
  if (!(url in faviconCache)) faviconCacheKeys.push(url)
  faviconCache[url] = icon
  while (faviconCacheKeys.length > MAX_FAVICON_CACHE) {
    const oldest = faviconCacheKeys.shift()
    delete faviconCache[oldest]
  }
}