/**
 * Bookmarks adapter — wraps chrome.bookmarks for Arc UX favorites.
 *
 * Design (informed by previous failed attempt):
 *   - Zero work at module load. No top-level chrome.bookmarks.* calls.
 *   - Listeners attach only after ensureReady() succeeds.
 *   - Every API call wrapped in try/catch; failures are non-fatal.
 *   - 100ms debounce coalesces bookmark events into a single rebuild callback.
 */

const FAVORITES_FOLDER_NAME = 'My Favorites'
const OTHER_BOOKMARKS_ID    = '2'
const DEBOUNCE_MS           = 100
const MAX_FAVICON_CACHE     = 500

let _rootId            = null
let _onChange          = null
let _importing         = false
let _debounceTimer     = null
let _listenersAttached = false

/**
 * Ensure the "My Favorites" folder exists and listeners are attached.
 * Idempotent.
 * @returns {{ok: true, rootId: string} | {ok: false, error: string}}
 */
export async function ensureBookmarksReady(existingRootId) {
  try {
    // Validate existing id if provided
    if (existingRootId) {
      try {
        const [node] = await chrome.bookmarks.get(existingRootId)
        if (node && !node.url && node.title === FAVORITES_FOLDER_NAME) {
          _rootId = existingRootId
          attachListenersOnce()
          return { ok: true, rootId: _rootId }
        }
      } catch (_) { /* stale, fall through */ }
    }
    // Search under Other Bookmarks
    try {
      const children = await chrome.bookmarks.getChildren(OTHER_BOOKMARKS_ID)
      const match = children.find((n) => !n.url && n.title === FAVORITES_FOLDER_NAME)
      if (match) {
        _rootId = match.id
        attachListenersOnce()
        return { ok: true, rootId: _rootId }
      }
    } catch (_) { /* fall through */ }
    // Create fresh
    const created = await chrome.bookmarks.create({
      parentId: OTHER_BOOKMARKS_ID,
      title:    FAVORITES_FOLDER_NAME,
    })
    _rootId = created.id
    attachListenersOnce()
    return { ok: true, rootId: _rootId }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/**
 * Read the favorites subtree as { favorites, folders }.
 * Favorites = all url-bearing bookmarks (flattened from any depth).
 * Folders = depth-0 folders directly under root (v1 shows one level).
 */
/**
 * Read the favorites subtree.
 * Favorites = all url-bearing bookmarks (flattened, parentId preserved).
 * Folders = ALL folders at any depth (parentId preserved for hierarchy).
 */
export async function readFavoritesTree(faviconCache = {}) {
  if (!_rootId) return { favorites: [], folders: [] }
  try {
    const result = await chrome.bookmarks.getSubTree(_rootId)
    const tree = result?.[0]
    if (!tree?.children) return { favorites: [], folders: [] }
    const favorites = []
    const folders   = []
    function walk(node) {
      if (!node.children) return
      node.children.forEach((child, index) => {
        if (child.url) {
          if (child.url.startsWith('javascript:')) return
          favorites.push({
            id:         child.id,
            url:        child.url,
            title:      child.title || '',
            parentId:   child.parentId,
            order:      index,
            favIconUrl: faviconCache[child.url] || '',
          })
        } else {
          folders.push({
            id:       child.id,
            title:    child.title || '',
            parentId: child.parentId,
            order:    index,
          })
          walk(child)
        }
      })
    }
    walk(tree)
    return { favorites, folders }
  } catch (_) {
    return { favorites: [], folders: [] }
  }
}

export async function createBookmark(url, title, parentId) {
  if (!_rootId) return null
  try {
    return await chrome.bookmarks.create({
      parentId: parentId || _rootId,
      url,
      title: title || '',
    })
  } catch (_) {
    return null
  }
}

export async function createFolder(title, parentId) {
  if (!_rootId) return null
  try {
    return await chrome.bookmarks.create({
      parentId: parentId || _rootId,
      title:    title || 'New folder',
    })
  } catch (_) {
    return null
  }
}

export async function removeBookmark(id) {
  try { await chrome.bookmarks.remove(id); return true } catch (_) { return false }
}

export async function removeFolder(id) {
  try { await chrome.bookmarks.removeTree(id); return true } catch (_) { return false }
}

export async function updateBookmark(id, changes) {
  try { await chrome.bookmarks.update(id, changes); return true } catch (_) { return false }
}

export async function moveBookmark(id, { parentId, index } = {}) {
  const dest = {}
  if (parentId) dest.parentId = parentId
  if (typeof index === 'number') dest.index = index
  try { await chrome.bookmarks.move(id, dest); return true } catch (_) { return false }
}

export function setBookmarkChangeCallback(cb) { _onChange = cb }

export function getRootId() { return _rootId }

// ─── internals ───────────────────────────────────────────────────────────────

function scheduleRebuild() {
  if (_importing || !_onChange) return
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    try { _onChange() } catch (e) { console.warn('Arc bookmark callback error:', e) }
  }, DEBOUNCE_MS)
}

function attachListenersOnce() {
  if (_listenersAttached) return
  _listenersAttached = true
  try {
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
  } catch (e) {
    _listenersAttached = false
    console.warn('Arc: failed to attach bookmark listeners', e)
  }
}

export function cacheFavicon(cache, keys, url, icon) {
  if (!url || !icon) return
  if (cache[url] === icon) return
  if (!(url in cache)) keys.push(url)
  cache[url] = icon
  while (keys.length > MAX_FAVICON_CACHE) {
    const oldest = keys.shift()
    delete cache[oldest]
  }
}