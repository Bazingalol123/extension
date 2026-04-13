/**
 * URL matching utilities for comparing pinned URLs with tab URLs.
 */

/**
 * Normalizes a URL for comparison by stripping protocol, www prefix, and trailing slash.
 * @param {string} url
 * @returns {string} normalized URL string
 */
export function normalizeUrl(url) {
  if (!url) return ''
  try {
    let normalized = url.trim().toLowerCase()
    // Strip protocol
    normalized = normalized.replace(/^https?:\/\//, '')
    // Strip www.
    normalized = normalized.replace(/^www\./, '')
    // Strip trailing slash
    normalized = normalized.replace(/\/+$/, '')
    return normalized
  } catch {
    return url
  }
}

/**
 * Compares two URLs after normalization. Strips protocol, www, and trailing slash.
 * @param {string} url1
 * @param {string} url2
 * @returns {boolean} true if the URLs match after normalization
 */
export function urlsMatch(url1, url2) {
  return normalizeUrl(url1) === normalizeUrl(url2)
}
