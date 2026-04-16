/**
 * Normalise a URL for comparison:
 *   - lowercase scheme + host
 *   - strip trailing slash on path
 *   - strip www. prefix
 *   - strip hash fragment (changes never affect what is displayed)
 * Query params are preserved because ?tab=2 and ?tab=3 are different pages.
 *
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    u.hostname = u.hostname.replace(/^www\./, '')
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
    u.hash = ''
    return u.toString().toLowerCase()
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

/**
 * Returns true if two URLs point to the same page (case-insensitive,
 * trailing-slash-insensitive, www-insensitive).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function urlsMatch(a, b) {
  if (!a || !b) return false
  return normalizeUrl(a) === normalizeUrl(b)
}

/**
 * Returns the hostname without www., lowercased.
 * Safe to call on invalid / empty URLs.
 *
 * @param {string} url
 * @returns {string}
 */
export function getDomain(url) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Returns true if the url looks like a user-typeable URL rather than a search query.
 * Handles: https://..., http://..., localhost:..., domain.tld, IP addresses.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isUrl(str) {
  if (!str) return false
  const s = str.trim()
  if (/^https?:\/\//i.test(s)) return true
  if (/^localhost(:\d+)?/i.test(s)) return true
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(s)) return true
  if (/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}(\/|$)/i.test(s)) return true
  return false
}

/**
 * Returns the favicon URL from a tab's stored favIconUrl.
 * Falls back to a simple letter-based placeholder value (caller renders it).
 * Does NOT use Google's favicon service (blocked by Brave Shields).
 *
 * @param {string} favIconUrl
 * @returns {string|null}  null means "use letter fallback"
 */
export function getFaviconSrc(favIconUrl) {
  if (!favIconUrl) return null
  // Filter out data: URIs that are blank/default (some browsers emit these)
  if (favIconUrl === 'data:') return null
  if (favIconUrl.startsWith('chrome://')) return null
  if (favIconUrl.startsWith('chrome-extension://')) return null
  return favIconUrl
}

/**
 * Generate a stable single letter + background color for favicon fallback.
 * Uses the tab title or domain; returns an object { letter, color }.
 *
 * @param {string} title
 * @param {string} url
 * @returns {{ letter: string, color: string }}
 */
export function getFaviconFallback(title, url) {
  const PALETTE = [
    '#8B7CF6', '#F87171', '#34D399', '#FBBF24',
    '#60A5FA', '#F472B6', '#FB923C', '#A78BFA',
  ]
  // Pick a meaningful letter — skip generic titles
  const domain = getDomain(url)
  const generic = new Set(['new tab', 'about:blank', ''])
  const source = generic.has((title || '').toLowerCase()) ? domain : (title || domain)
  const letter = (source || '?')[0].toUpperCase()

  // Deterministic color from character code
  const code = (source || '?').charCodeAt(0)
  const color = PALETTE[code % PALETTE.length]

  return { letter, color }
}