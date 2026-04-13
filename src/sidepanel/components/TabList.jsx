import React from 'react'
import TabItem from './TabItem'

/**
 * Shows tabs for the active space, sorted by most recently opened.
 * Displays a "no tabs" message when empty.
 */
export default function TabList({ tabs, activeTabId, accentColor, spaces }) {
  const sorted = [...tabs].sort((a, b) => b.openedAt - a.openedAt)

  return (
    <div className="tabs-area">
      <div className="section">
        {sorted.length === 0 ? (
          <div className="section-empty">
            No tabs open — press Ctrl+T to start
          </div>
        ) : (
          sorted.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              accentColor={accentColor}
              spaces={spaces}
            />
          ))
        )}
      </div>
    </div>
  )
}
