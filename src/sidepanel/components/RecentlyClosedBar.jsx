import React, { useState } from 'react'
import useStore from '../store'
import { getFaviconFallback, getFaviconSrc } from '@shared/utils.js'

/**
 * Shows the last few recently-closed tabs as a collapsible section
 * just above the bottom bar. Click any entry to restore it.
 */
export default function RecentlyClosedBar() {
  const { recentlyClosed, restoreClosedTab, clearClosedTabs } = useStore()
  const [expanded, setExpanded] = useState(false)

  if (!recentlyClosed || recentlyClosed.length === 0) return null

  const visible = expanded ? recentlyClosed : recentlyClosed.slice(0, 3)

  return (
    <div className="recently-closed-bar">
      <div className="recently-closed-header">
        <button
          className="recently-closed-label"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? '▾' : '▸'} Recently Closed ({recentlyClosed.length})
        </button>
        <button className="recently-closed-clear" onClick={clearClosedTabs} title="Clear all">
          Clear
        </button>
      </div>

      <div className="recently-closed-list">
        {visible.map((entry) => (
          <ClosedTabItem key={entry.id} entry={entry} onRestore={restoreClosedTab} />
        ))}
        {!expanded && recentlyClosed.length > 3 && (
          <button
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'inherit',
              padding: '3px 6px', textAlign: 'left',
            }}
            onClick={() => setExpanded(true)}
          >
            +{recentlyClosed.length - 3} more…
          </button>
        )}
      </div>
    </div>
  )
}

function ClosedTabItem({ entry, onRestore }) {
  const [imgError, setImgError] = useState(false)
  const favicon = getFaviconSrc(entry.favIconUrl)
  const fallback = getFaviconFallback(entry.title, entry.url)

  return (
    <div
      className="closed-tab-item"
      onClick={() => onRestore(entry.id)}
      title={`${entry.title}\n${entry.url}\nClick to restore`}
    >
      {favicon && !imgError ? (
        <img src={favicon} width={13} height={13} style={{ borderRadius: 2, flexShrink: 0 }}
          onError={() => setImgError(true)} />
      ) : (
        <span style={{
          width: 13, height: 13, borderRadius: 2, flexShrink: 0,
          background: fallback.color, fontSize: 7, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {fallback.letter}
        </span>
      )}
      <span className="closed-tab-title">{entry.title || entry.url}</span>
    </div>
  )
}