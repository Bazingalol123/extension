import React, { useState } from 'react'

/* ── Helpers ── */

/**
 * Extract a favicon URL from a page URL.
 * @param {string} url
 * @returns {string}
 */
export function getFaviconUrl(url) {
  try {
    const { origin } = new URL(url)
    return `${origin}/favicon.ico`
  } catch {
    return ''
  }
}

/**
 * Extract the hostname (without www.) from a URL.
 * @param {string} url
 * @returns {string}
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

/* ── SVG icon map for action items ── */

const ACTION_ICONS = {
  search: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  url: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  new: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
}

/* ── Favicon sub-component with error fallback ── */

export const Favicon = ({ src, title }) => {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <div className="result-favicon-fallback">
        {(title || '?')[0]}
      </div>
    )
  }

  return (
    <img
      className="result-favicon"
      src={src}
      alt=""
      onError={() => setErrored(true)}
    />
  )
}

/* ── ResultItem — renders a single result row ── */

/**
 * @param {{ item: object, active: boolean, index: number, onClick: () => void, onMouseEnter: () => void }} props
 *
 * item.kind is one of: 'tab' | 'history' | 'action'
 */
const ResultItem = ({ item, active, index, onClick, onMouseEnter }) => {
  const className = `result-item${active ? ' selected' : ''}`

  if (item.kind === 'tab') {
    return (
      <div
        data-idx={index}
        className={className}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        key={`tab-${item.id}`}
      >
        <Favicon src={item.favIconUrl} title={item.title} />
        <div className="result-text">
          <div className="result-title">{item.title}</div>
          <div className="result-subtitle">{getDomain(item.url)}</div>
        </div>
        <span className="result-badge open">Open</span>
      </div>
    )
  }

  if (item.kind === 'history') {
    return (
      <div
        data-idx={index}
        className={className}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        key={`hist-${item.url}`}
      >
        <Favicon src={getFaviconUrl(item.url)} title={item.title} />
        <div className="result-text">
          <div className="result-title">{item.title}</div>
          <div className="result-subtitle">{getDomain(item.url)}</div>
        </div>
        <span className="result-badge">History</span>
      </div>
    )
  }

  /* kind === 'action' */
  return (
    <div
      data-idx={index}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      key={`act-${item.label}`}
    >
      <div className="result-icon">
        {ACTION_ICONS[item.icon]}
      </div>
      <div className="result-text">
        <div className="result-title">{item.label}</div>
        <div className="result-subtitle">{item.subtitle}</div>
      </div>
    </div>
  )
}

export default ResultItem
