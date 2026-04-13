import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import useStore from './store'
import SpaceSelector from './components/SpaceSelector'
import FavoritesBar, { FavTile } from './components/FavoritesBar'
import PinnedUrlsBar, { PinnedTile } from './components/PinnedUrlsBar'
import TabItem, { SortableTabItem } from './components/TabItem'
import FolderItem from './components/FolderItem'
import BottomBar from './components/BottomBar'
import NewTabModal from './components/NewTabModal'
import TabSwitcher from './components/TabSwitcher'
import { urlsMatch } from '@shared/utils.js'
import { Messages } from '@shared/messages.js'

/**
 * Root sidebar layout component.
 *
 * Calls store.load() on mount, displays a loading state while loading,
 * and renders the full sidebar with:
 * 1. Header row (SpaceSelector + collapse button)
 * 2. Pinned URLs bar (global, visible in all spaces)
 * 3. Favorites bar (if any)
 * 4. Tab list (unpinned tabs for current space)
 * 5. Bottom bar
 *
 * Also supports collapsed "rail" mode with Alt+S shortcut.
 *
 * A single top-level DndContext wraps pinned, favorites, and tab areas
 * so items can be dragged across all three zones.
 */
export default function App() {
  const {
    spaces,
    activeSpaceId,
    tabs,
    favorites,
    pinnedUrls,
    folders,
    activeTabId,
    sidebarCollapsed,
    tabAccessOrder,
    loading,
    load,
    setSidebarCollapsed,
    switchSpace,
    activateFavoriteUrl,
    reorderTabs,
    addFavorite,
    pinUrl,
    reorderFavorites,
    reorderPins,
    createFolder,
    moveTabToFolder,
  } = useStore()

  // ─── New Tab Modal state ──────────────────────────────
  const [showNewTabModal, setShowNewTabModal] = useState(false)

  // ─── Tab Switcher state ───────────────────────────────
  const [showTabSwitcher, setShowTabSwitcher] = useState(false)

  // ─── New Space trigger (counter incremented to open SpaceSelector form) ──
  const [newSpaceTrigger, setNewSpaceTrigger] = useState(0)

  // ─── Unified drag-and-drop state ──────────────────────
  const [activeDragId, setActiveDragId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Load state on mount
  useEffect(() => {
    load()
  }, [load])

  // Alt+S keyboard shortcut to toggle collapsed sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarCollapsed, setSidebarCollapsed])

  // Ctrl+T keyboard shortcut to open new tab modal
  // Ctrl+Tab keyboard shortcut to open tab switcher
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        setShowNewTabModal(true)
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        setShowTabSwitcher((prev) => {
          // Only open if not already open
          if (!prev) return true
          return prev
        })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Listen for OPEN_NEW_TAB_MODAL messages from the background service worker
  useEffect(() => {
    const listener = (msg) => {
      if (msg.type === Messages.OPEN_NEW_TAB_MODAL) {
        setShowNewTabModal(true)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Derived data
  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId),
    [spaces, activeSpaceId]
  )
  const accentColor = activeSpace?.color ?? '#7C6AF7'

  const spaceTabs = useMemo(
    () => tabs.filter((t) => t.spaceId === activeSpaceId),
    [tabs, activeSpaceId]
  )

  const spaceFolders = useMemo(
    () => [...(folders || [])].filter((f) => f.spaceId === activeSpaceId).sort((a, b) => a.order - b.order),
    [folders, activeSpaceId]
  )

  const folderedTabIds = useMemo(() => {
    const ids = new Set()
    for (const folder of spaceFolders) {
      for (const id of folder.tabIds) {
        ids.add(id)
      }
    }
    return ids
  }, [spaceFolders])

  const looseTabs = useMemo(
    () => spaceTabs.filter((t) => !folderedTabIds.has(t.id)),
    [spaceTabs, folderedTabIds]
  )

  const sortedTabs = useMemo(
    () => [...spaceTabs].sort((a, b) => b.openedAt - a.openedAt),
    [spaceTabs]
  )

  const sortedLooseTabs = useMemo(
    () => [...looseTabs].sort((a, b) => b.openedAt - a.openedAt),
    [looseTabs]
  )

  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => a.order - b.order),
    [favorites]
  )

  const sortedPins = useMemo(
    () => [...pinnedUrls].sort((a, b) => a.order - b.order),
    [pinnedUrls]
  )

  // Determine what is currently being dragged for the DragOverlay
  const activeDragTab = sortedLooseTabs.find((t) => String(t.id) === String(activeDragId))
  const activeDragFav = sortedFavorites.find((f) => String(f.id) === String(activeDragId))
  const activeDragPin = sortedPins.find((p) => String(p.id) === String(activeDragId))

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveDragId(null)
      if (!over || active.id === over.id) return

      const isLooseTab = sortedLooseTabs.some((t) => String(t.id) === String(active.id))
      const isFav = sortedFavorites.some((f) => String(f.id) === String(active.id))

      if (isLooseTab) {
        // Tab dropped on favorites zone or on a specific favorite tile
        if (
          over.id === 'favorites-droppable' ||
          sortedFavorites.some((f) => String(f.id) === String(over.id))
        ) {
          const tab = sortedLooseTabs.find((t) => String(t.id) === String(active.id))
          if (tab) addFavorite(tab)
          return
        }
        // Tab dropped on pinned zone or on a specific pin tile
        if (
          over.id === 'pinned-droppable' ||
          sortedPins.some((p) => String(p.id) === String(over.id))
        ) {
          const tab = sortedLooseTabs.find((t) => String(t.id) === String(active.id))
          if (tab) pinUrl(tab)
          return
        }

        // Tab dropped on a folder droppable zone
        if (over.id.toString().startsWith('folder-')) {
          const folderId = over.id.toString().replace('folder-', '')
          const tabId = Number(active.id)
          moveTabToFolder(tabId, folderId)
          return
        }

        // Tab dropped on another loose tab → create folder
        const overIsLooseTab = sortedLooseTabs.some((t) => String(t.id) === String(over.id))
        if (overIsLooseTab) {
          const activeTabId = Number(active.id)
          const overTabId = Number(over.id)
          if (!folderedTabIds.has(activeTabId) && !folderedTabIds.has(overTabId)) {
            // Only create folder if they are different tabs
            if (activeTabId !== overTabId) {
              createFolder(activeSpaceId, 'New Folder', [overTabId, activeTabId])
              return
            }
          }
        }

        // Tab reorder (dropped on another loose tab, same position handling)
        const oldIndex = sortedLooseTabs.findIndex((t) => String(t.id) === String(active.id))
        const newIndex = sortedLooseTabs.findIndex((t) => String(t.id) === String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(sortedLooseTabs, oldIndex, newIndex)
          reorderTabs(reordered.map((t) => t.id))
        }
      } else if (isFav) {
        // Favorite reorder
        const oldIndex = sortedFavorites.findIndex((f) => String(f.id) === String(active.id))
        const newIndex = sortedFavorites.findIndex((f) => String(f.id) === String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(sortedFavorites, oldIndex, newIndex)
          reorderFavorites(reordered.map((f) => f.id))
        }
      } else {
        // Pin reorder
        const oldIndex = sortedPins.findIndex((p) => String(p.id) === String(active.id))
        const newIndex = sortedPins.findIndex((p) => String(p.id) === String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(sortedPins, oldIndex, newIndex)
          reorderPins(reordered.map((p) => p.id))
        }
      }
    },
    [sortedLooseTabs, sortedFavorites, sortedPins, folderedTabIds, activeSpaceId, reorderTabs, reorderFavorites, reorderPins, addFavorite, pinUrl, createFolder, moveTabToFolder]
  )

  // Loading state
  if (loading) {
    return <div className="loading-state">Loading…</div>
  }

  // ─── Collapsed "rail" mode ──────────────────────────────
  if (sidebarCollapsed) {
    const sortedFavs = [...favorites].sort((a, b) => a.order - b.order)

    return (
      <div className="sidebar collapsed" style={{ '--space-color': accentColor }}>
        <button
          className="collapse-toggle"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand (Alt+S)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="rail-spaces">
          {spaces.map((s) => (
            <div
              key={s.id}
              className={`rail-space${s.id === activeSpaceId ? ' active' : ''}`}
              onClick={() => {
                switchSpace(s.id)
                setSidebarCollapsed(false)
              }}
              title={s.name}
            >
              {s.emoji}
            </div>
          ))}
        </div>

        {sortedFavs.length > 0 && (
          <div className="rail-favs">
            {sortedFavs.map((fav) => (
              <RailFav key={fav.id} fav={fav} onOpen={activateFavoriteUrl} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Expanded sidebar ───────────────────────────────────
  return (
    <div className="sidebar" style={{ '--space-color': accentColor }}>
      {/* Header: SpaceSelector + Collapse Button */}
      <div className="sidebar-header-row">
        <SpaceSelector spaces={spaces} activeSpaceId={activeSpaceId} createTrigger={newSpaceTrigger} />
        <button
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(true)}
          title="Minimize (Alt+S)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Single DndContext wrapping all draggable/droppable areas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Pinned URLs (global — visible in all spaces) */}
        {pinnedUrls.length > 0 && (
          <PinnedUrlsBar pins={pinnedUrls} accentColor={accentColor} tabs={tabs} />
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <FavoritesBar favorites={favorites} accentColor={accentColor} />
        )}

        {/* Tabs */}
        <div className="tabs-area">
          <div className="section">
            {spaceTabs.length === 0 ? (
              <div className="section-empty">
                No tabs open — press Ctrl+T to start
              </div>
            ) : (
              <>
                {/* Folders */}
                {spaceFolders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    tabs={spaceTabs}
                    activeTabId={activeTabId}
                    accentColor={accentColor}
                    spaces={spaces}
                    activeSpaceId={activeSpaceId}
                  />
                ))}

                {/* Loose tabs */}
                <SortableContext
                  items={sortedLooseTabs.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedLooseTabs.map((tab) => (
                    <SortableTabItem
                      key={tab.id}
                      id={tab.id}
                      tab={tab}
                      isActive={tab.id === activeTabId}
                      accentColor={accentColor}
                      spaces={spaces}
                      folderId={null}
                      spaceFolders={spaceFolders}
                      activeSpaceId={activeSpaceId}
                    />
                  ))}
                </SortableContext>
              </>
            )}
          </div>
        </div>

        {/* Unified DragOverlay for all drag types */}
        <DragOverlay>
          {activeDragTab && (
            <div style={{ opacity: 0.85, transform: 'scale(1.02)', cursor: 'grabbing' }}>
              <TabItem
                tab={activeDragTab}
                isActive={activeDragTab.id === activeTabId}
                accentColor={accentColor}
                spaces={spaces}
                folderId={null}
                spaceFolders={spaceFolders}
                activeSpaceId={activeSpaceId}
              />
            </div>
          )}
          {activeDragFav && (
            <div style={{ opacity: 0.8, transform: 'scale(1.12)', cursor: 'grabbing' }}>
              <FavTile fav={activeDragFav} isDragging accentColor={accentColor} />
            </div>
          )}
          {activeDragPin && (
            <div style={{ opacity: 0.85, transform: 'scale(1.1)', cursor: 'grabbing' }}>
              <PinnedTile
                pin={activeDragPin}
                accentColor={accentColor}
                isOpen={tabs.some((t) => urlsMatch(t.url, activeDragPin.url))}
                matchingTab={tabs.find((t) => urlsMatch(t.url, activeDragPin.url))}
                dragging
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Bottom Bar */}
      <BottomBar
        onNewTab={() => setShowNewTabModal(true)}
        onNewSpace={() => setNewSpaceTrigger((n) => n + 1)}
        onNewFolder={() => createFolder(activeSpaceId, 'New Folder', [])}
      />

      {/* New Tab Modal */}
      <NewTabModal
        isOpen={showNewTabModal}
        onClose={() => setShowNewTabModal(false)}
        tabs={tabs}
        accentColor={accentColor}
      />

      {/* Tab Switcher Modal (Ctrl+Tab) */}
      <TabSwitcher
        isOpen={showTabSwitcher}
        onClose={() => setShowTabSwitcher(false)}
        tabs={tabs}
        tabAccessOrder={tabAccessOrder}
        activeSpaceId={activeSpaceId}
        spaces={spaces}
      />
    </div>
  )
}

/**
 * Small favicon for the collapsed rail view.
 */
function RailFav({ fav, onOpen }) {
  const [imgError, setImgError] = React.useState(false)

  return (
    <div className="rail-fav" onClick={() => onOpen(fav.url)} title={fav.title}>
      {fav.favIconUrl && !imgError ? (
        <img
          src={fav.favIconUrl}
          width={16}
          height={16}
          style={{ borderRadius: 3 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)' }}>
          {fav.title[0]}
        </span>
      )}
    </div>
  )
}
