import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from './store'
import SpaceSelector from './components/SpaceSelector'
import FavoritesBar, {FavoriteRow} from './components/FavoritesBar.jsx'
import PinnedUrlsBar, { PinnedTile } from './components/PinnedUrlsBar'
import TabItem, { SortableTabItem } from './components/TabItem'
import BottomBar from './components/BottomBar'
import NewTabModal from './components/NewTabModal'
import RecentlyClosedBar from './components/RecentlyClosedBar'
import SessionsPanel from './components/SessionsPanel'
import { urlsMatch } from '@shared/utils.js'
import { Messages } from '@shared/messages.js'

export default function App() {
  const {
    spaces, activeSpaceId, tabs, favorites, pinnedUrls, favoriteFolders,
    activeTabId, sidebarCollapsed, tabAccessOrder, loading, darkMode,
    myWindowId,
    load, setSidebarCollapsed, switchSpace, activateFavorite,
    reorderTabs, addFavorite, pinUrl, reorderFavorites, reorderPins,
    moveFavorite, setDarkMode, favoriteOwnerships, 
  } = useStore()

  const [showNewTabModal, setShowNewTabModal] = useState(false)
  const [showSessions, setShowSessions]       = useState(false)
  const [newSpaceTrigger, setNewSpaceTrigger] = useState(0)
  const [activeDragId, setActiveDragId]       = useState(null)
  const [tabSearch, setTabSearch]             = useState('')
  const tabsAreaRef = useRef(null)
  const sensors     = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { load() }, [load])

  // Apply dark mode on mount
  useEffect(() => {
    if (loading) return
    if (darkMode === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', darkMode)
  }, [darkMode, loading])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      // Alt+S — toggle sidebar
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault(); setSidebarCollapsed(!sidebarCollapsed); return
      }

      // Ctrl+T — open centered new tab modal popup window
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        chrome.runtime.sendMessage({
          type: Messages.NEW_TAB_MODAL_OPEN,
          screenWidth:  window.screen.width,
          screenHeight: window.screen.height,
        }).catch(() => {})
        return
      }

      // Ctrl+Q — open Tab Switcher popup window
      // NOTE: Ctrl+Tab cannot be intercepted by extension JavaScript — the browser
      // handles it at the native level before any JS keydown event fires.
      // Ctrl+Q is not reserved by any browser and works reliably in the side panel.
      // The BottomBar also has a click button as a permanent fallback.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault()
        chrome.runtime.sendMessage({
          type: Messages.TAB_SWITCHER_OPEN,
          screenWidth:  window.screen.width,
          screenHeight: window.screen.height,
        }).catch(() => {})
        return
      }

      // Ctrl+1–9 — switch to Nth space
      // Using Ctrl (not Alt) intentionally: the side panel's separate window
      // context should capture these before the browser's tab-switching shortcut.
      // e.preventDefault() here prevents the browser from also switching to tab N.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (idx < spaces.length) {
          e.preventDefault()
          switchSpace(spaces[idx].id)
        }
        return
      }

      // Ctrl+F — focus tab search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.getElementById('tab-search-input')?.focus()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [sidebarCollapsed, setSidebarCollapsed, spaces, switchSpace])

  // Listen for OPEN_NEW_TAB_MODAL from background
  useEffect(() => {
    const listener = (msg) => {
      if (msg.type === Messages.OPEN_NEW_TAB_MODAL) setShowNewTabModal(true)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Scroll active tab into view on space switch
  useEffect(() => {
    if (!activeTabId || !tabsAreaRef.current) return
    const el = tabsAreaRef.current.querySelector(`[data-tab-id="${activeTabId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSpaceId, activeTabId])

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeSpace   = useMemo(() => spaces.find((s) => s.id === activeSpaceId), [spaces, activeSpaceId])
  const accentColor   = activeSpace?.color ?? '#7C6AF7'

  // Phase 1: narrow to this sidepanel's window first.
  // While myWindowId is resolving (briefly on mount), render nothing rather than
  // leak other-window tabs into this view.
 const windowTabs = useMemo(
    () => {
      if (myWindowId == null) return []
      const ownedTabIds = new Set(
        (favoriteOwnerships || []).filter(o => o.windowId === myWindowId).map(o => o.tabId)
      )
      return tabs.filter(t => t.windowId === myWindowId && !ownedTabIds.has(t.id))
    },
    [tabs, myWindowId, favoriteOwnerships]
  )

  const spaceTabs = useMemo(
    () => windowTabs.filter((t) => t.spaceId === activeSpaceId),
    [windowTabs, activeSpaceId]
  )

  const sortedLooseTabs = useMemo(
    () => [...spaceTabs].sort((a, b) => b.openedAt - a.openedAt),
    [spaceTabs]
  )
   
  const sortedFavorites = useMemo(() => [...favorites].sort((a, b) => a.order - b.order), [favorites])
  const sortedPins      = useMemo(() => [...pinnedUrls].sort((a, b) => a.order - b.order), [pinnedUrls])

  const filteredLooseTabs = useMemo(() => {
    if (!tabSearch.trim()) return sortedLooseTabs
    const q = tabSearch.toLowerCase()
    return sortedLooseTabs.filter((t) => t.title?.toLowerCase().includes(q) || t.url?.toLowerCase().includes(q))
  }, [sortedLooseTabs, tabSearch])

  const duplicateUrls = useMemo(() => {
    const seen = new Map()
    for (const t of spaceTabs) seen.set(t.url, (seen.get(t.url) || 0) + 1)
    const dupes = new Set()
    for (const [url, count] of seen) if (count > 1) dupes.add(url)
    return dupes
  }, [spaceTabs])

  const tabCountBySpace = useMemo(() => {
    const counts = {}
    for (const t of tabs) counts[t.spaceId] = (counts[t.spaceId] || 0) + 1
    return counts
  }, [tabs])

  const activeDragTab = sortedLooseTabs.find((t) => String(t.id) === String(activeDragId))
  const activeDragFav = sortedFavorites.find((f) => String(f.id) === String(activeDragId))
  const activeDragPin = sortedPins.find((p) => String(p.id) === String(activeDragId))

  const handleDragStart = useCallback((e) => setActiveDragId(e.active.id), [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveDragId(null)
      if (!over || active.id === over.id) return

      const isLooseTab = sortedLooseTabs.some((t) => String(t.id) === String(active.id))
      const isFav      = sortedFavorites.some((f) => String(f.id) === String(active.id))

      if (isLooseTab) {
       if (over.id === 'favorites-droppable' ||sortedFavorites.some((f) => String(f.id) === String(over.id)) ||String(over.id).startsWith('fav-folder-')) {
          const tab = sortedLooseTabs.find((t) => String(t.id) === String(active.id))
            if (tab) {
                const parentId = String(over.id).startsWith('fav-folder-')
                ? String(over.id).replace('fav-folder-', '')
                : undefined
                addFavorite(tab, parentId)
            }
            return
        }
        if (over.id === 'pinned-droppable' || sortedPins.some((p) => String(p.id) === String(over.id))) {
          const tab = sortedLooseTabs.find((t) => String(t.id) === String(active.id))
          if (tab) pinUrl(tab); return
        }
        const overIsLoose = sortedLooseTabs.some((t) => String(t.id) === String(over.id))
        if (overIsLoose) {
          const oi = sortedLooseTabs.findIndex((t) => String(t.id) === String(active.id))
          const ni = sortedLooseTabs.findIndex((t) => String(t.id) === String(over.id))
          if (oi !== -1 && ni !== -1) reorderTabs(arrayMove(sortedLooseTabs, oi, ni).map((t) => t.id))
        }
      } else if (isFav) {
        // Drag into a folder header/body
        if (String(over.id).startsWith('fav-folder-')) {
          const folderId = String(over.id).replace('fav-folder-', '')
          moveFavorite(active.id, folderId)
          return
        }
        // Drag over another favorite that's inside a folder — move into that folder
        const overFav = sortedFavorites.find((f) => String(f.id) === String(over.id))
        const activeFav = sortedFavorites.find((f) => String(f.id) === String(active.id))
        if (overFav && activeFav && overFav.parentId !== activeFav.parentId) {
          moveFavorite(active.id, overFav.parentId)
          return
        }
        // Same-parent reorder (top-level among top-level, or within same folder)
        const oi = sortedFavorites.findIndex((f) => String(f.id) === String(active.id))
        const ni = sortedFavorites.findIndex((f) => String(f.id) === String(over.id))
        if (oi !== -1 && ni !== -1) reorderFavorites(arrayMove(sortedFavorites, oi, ni).map((f) => f.id))
      } else {
        const oi = sortedPins.findIndex((p) => String(p.id) === String(active.id))
        const ni = sortedPins.findIndex((p) => String(p.id) === String(over.id))
        if (oi !== -1 && ni !== -1) reorderPins(arrayMove(sortedPins, oi, ni).map((p) => p.id))
      }
    },
    [sortedLooseTabs, sortedFavorites, sortedPins,
     reorderTabs, reorderFavorites, reorderPins, addFavorite, pinUrl, moveFavorite]
  )

  if (loading) return <div className="loading-state">Loading…</div>

  // ── Rail mode ──────────────────────────────────────────────────────────────
  if (sidebarCollapsed) {
    const sortedFavs = [...favorites].sort((a, b) => a.order - b.order)
    return (
      <div className="sidebar collapsed" style={{ '--space-color': accentColor }}>
        <button className="collapse-toggle" onClick={() => setSidebarCollapsed(false)} title="Expand (Alt+S)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div className="rail-spaces">
          {spaces.map((s, idx) => (
            <div key={s.id}
              className={`rail-space${s.id === activeSpaceId ? ' active' : ''}`}
              style={s.id === activeSpaceId ? { '--space-color': s.color } : {}}
              onClick={() => { switchSpace(s.id); setSidebarCollapsed(false) }}
              title={`${s.name} (${tabCountBySpace[s.id] || 0} tabs) — Ctrl+${idx + 1}`}
            >{s.emoji}</div>
          ))}
        </div>
        {sortedFavs.length > 0 && (
          <div className="rail-favs">
            {sortedFavs.map((fav) => <RailFav key={fav.id} fav={fav} onOpen={activateFavorite} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Expanded sidebar ───────────────────────────────────────────────────────
  return (
    <div className="sidebar" style={{ '--space-color': accentColor }}>
      <div className="sidebar-header-row">
        <SpaceSelector
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          createTrigger={newSpaceTrigger}
          tabCountBySpace={tabCountBySpace}
        />
        <button className="collapse-btn" onClick={() => setSidebarCollapsed(true)} title="Minimize (Alt+S)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Tab search */}
      <div className="tab-search-bar">
        <div className="tab-search-wrapper">
          <svg className="tab-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="tab-search-input"
            className="tab-search-input"
            placeholder="Filter tabs… (Ctrl+F)"
            value={tabSearch}
            onChange={(e) => setTabSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setTabSearch('')}
          />
          {tabSearch && <button className="tab-search-clear" onClick={() => setTabSearch('')}>×</button>}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {pinnedUrls.length > 0 && <PinnedUrlsBar pins={sortedPins} accentColor={accentColor} tabs={windowTabs} />}
        <FavoritesBar favorites={sortedFavorites} folders={favoriteFolders} accentColor={accentColor} />

        <div className="tabs-area" ref={tabsAreaRef}>
          <div className="section">
            {spaceTabs.length === 0 ? (
              <div className="section-empty">No tabs — press Ctrl+T to start</div>
            ) : filteredLooseTabs.length === 0 && tabSearch ? (
              <div className="section-empty">No tabs match "{tabSearch}"</div>
            ) : (
              <SortableContext items={filteredLooseTabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {filteredLooseTabs.map((tab) => (
                  <SortableTabItem key={tab.id} id={tab.id} tab={tab} isActive={tab.id === activeTabId} accentColor={accentColor} spaces={spaces} activeSpaceId={activeSpaceId} isDuplicate={duplicateUrls.has(tab.url)} />
                ))}
              </SortableContext>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDragTab && <div style={{ opacity: 0.85, transform: 'scale(1.02)', cursor: 'grabbing' }}><TabItem tab={activeDragTab} isActive={activeDragTab.id === activeTabId} accentColor={accentColor} spaces={spaces} activeSpaceId={activeSpaceId} /></div>}
          {activeDragFav && <div style={{ opacity: 0.8, transform: 'scale(1.12)', cursor: 'grabbing' }}><FavoriteRow fav={activeDragFav} accentColor={accentColor} /></div>}
          {activeDragPin && <div style={{ opacity: 0.85, transform: 'scale(1.1)', cursor: 'grabbing' }}><PinnedTile pin={activeDragPin} accentColor={accentColor} isOpen={windowTabs.some((t) => urlsMatch(t.url, activeDragPin.url))} dragging /></div>}
        </DragOverlay>
      </DndContext>

      <RecentlyClosedBar />

      <BottomBar
        onNewTab={() => setShowNewTabModal(true)}
        onNewSpace={() => setNewSpaceTrigger((n) => n + 1)}
        onSessions={() => setShowSessions(true)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(darkMode === 'light' ? 'dark' : darkMode === 'dark' ? 'auto' : 'light')}
      />

      <NewTabModal isOpen={showNewTabModal} onClose={() => setShowNewTabModal(false)} tabs={tabs} accentColor={accentColor} />
      {showSessions && <SessionsPanel onClose={() => setShowSessions(false)} />}
    </div>
  )
}

function RailFav({ fav, onOpen }) {
  const [err, setErr] = React.useState(false)
  return (
    <div className="rail-fav" onClick={() => onOpen(fav.url)} title={fav.title}>
      {fav.favIconUrl && !err
        ? <img src={fav.favIconUrl} width={16} height={16} style={{ borderRadius: 3 }} onError={() => setErr(true)} />
        : <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)' }}>{(fav.title || '?')[0].toUpperCase()}</span>
      }
    </div>
  )
}