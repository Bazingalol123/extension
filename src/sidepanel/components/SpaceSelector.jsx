import React, { useState, useEffect, useRef } from 'react'
import useStore from '../store'

const EMOJI_OPTIONS = ['🏠','💼','🎮','📚','🎨','✈️','🔬','💬','🎵','🌱','⚡','🏆','🧪','🎯','🛒','🌍']
const COLOR_OPTIONS = ['#8B7CF6','#F87171','#34D399','#FBBF24','#60A5FA','#F472B6','#A78BFA','#FB923C','#2DD4BF','#E879F9']

/**
 * SpaceSelector — horizontal row of space pills with tab-count badges.
 * Supports inline creation form and right-click rename/delete.
 *
 * @param {{ spaces, activeSpaceId, createTrigger, tabCountBySpace }} props
 */
export default function SpaceSelector({ spaces, activeSpaceId, createTrigger, tabCountBySpace = {} }) {
  const { switchSpace, createSpace, renameSpace, deleteSpace } = useStore()

  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [emoji, setEmoji]       = useState(EMOJI_OPTIONS[0])
  const [color, setColor]       = useState(COLOR_OPTIONS[0])
  const [ctxMenu, setCtxMenu]   = useState(null) // { x, y, space }
  const [editSpace, setEditSpace] = useState(null) // { id, name, emoji, color }
  const ctxRef = useRef(null)
  const nameInputRef = useRef(null)

  // Open create form when triggered from BottomBar
  useEffect(() => {
    if (createTrigger > 0) {
      setShowForm(true)
      setName('')
      setEmoji(EMOJI_OPTIONS[spaces.length % EMOJI_OPTIONS.length])
      setColor(COLOR_OPTIONS[spaces.length % COLOR_OPTIONS.length])
    }
  }, [createTrigger])

  // Focus name input when form opens
  useEffect(() => {
    if (showForm) setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [showForm])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  const handleCreate = () => {
    if (!name.trim()) return
    createSpace(name.trim(), emoji, color)
    setShowForm(false)
    setName('')
  }

  const handleRename = () => {
    if (!editSpace || !editSpace.name.trim()) return
    renameSpace(editSpace.id, editSpace.name, editSpace.emoji, editSpace.color)
    setEditSpace(null)
    setCtxMenu(null)
  }

  return (
    <>
      <div className="space-selector">
        <div className="spaces-list">
          {spaces.map((s, idx) => (
            <button
              key={s.id}
              className={`space-pill${s.id === activeSpaceId ? ' active' : ''}`}
              style={s.id === activeSpaceId ? { '--space-color': s.color } : {}}
              onClick={() => switchSpace(s.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setCtxMenu({ x: e.clientX, y: e.clientY, space: s })
              }}
              title={`${s.name} (${tabCountBySpace[s.id] || 0} tabs) — Ctrl+${idx + 1}`}
            >
              <span>{s.emoji}</span>
              <span>{s.name}</span>
              {tabCountBySpace[s.id] > 0 && (
                <span className="space-tab-count">{tabCountBySpace[s.id]}</span>
              )}
            </button>
          ))}
        </div>

        <button
          className="add-space-btn"
          onClick={() => setShowForm((p) => !p)}
          title="New Space"
        >
          +
        </button>
      </div>

      {/* Create Space Form */}
      {showForm && (
        <div className="new-space-form">
          <div className="emoji-picker">
            {EMOJI_OPTIONS.map((em) => (
              <button key={em} className={`emoji-option${emoji === em ? ' selected' : ''}`} onClick={() => setEmoji(em)}>
                {em}
              </button>
            ))}
          </div>
          <div className="color-swatches">
            {COLOR_OPTIONS.map((c) => (
              <div
                key={c}
                className={`color-swatch${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <input
            ref={nameInputRef}
            className="space-name-input"
            placeholder="Space name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false) }}
          />
          <div className="new-space-actions">
            <button className="btn-sm secondary" onClick={() => { setShowForm(false); setName('') }}>Cancel</button>
            <button className="btn-sm primary" onClick={handleCreate} disabled={!name.trim()}>Create</button>
          </div>
        </div>
      )}

      {/* Context menu (right-click on space pill) */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="context-menu"
          style={{ top: Math.min(ctxMenu.y, window.innerHeight - 180), left: ctxMenu.x - 4 }}
        >
          {editSpace && editSpace.id === ctxMenu.space.id ? (
            <>
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="emoji-picker">
                  {EMOJI_OPTIONS.slice(0, 8).map((em) => (
                    <button key={em} className={`emoji-option${editSpace.emoji === em ? ' selected' : ''}`}
                      onClick={() => setEditSpace((s) => ({ ...s, emoji: em }))}>
                      {em}
                    </button>
                  ))}
                </div>
                <div className="color-swatches">
                  {COLOR_OPTIONS.map((c) => (
                    <div key={c} className={`color-swatch${editSpace.color === c ? ' selected' : ''}`}
                      style={{ background: c }} onClick={() => setEditSpace((s) => ({ ...s, color: c }))} />
                  ))}
                </div>
                <input
                  className="space-name-input"
                  value={editSpace.name}
                  onChange={(e) => setEditSpace((s) => ({ ...s, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditSpace(null) }}
                  autoFocus
                />
                <div className="new-space-actions">
                  <button className="btn-sm secondary" onClick={() => setEditSpace(null)}>Cancel</button>
                  <button className="btn-sm primary" onClick={handleRename}>Save</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="context-item" onClick={() => setEditSpace({ ...ctxMenu.space })}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Rename
              </div>
              {spaces.length > 1 && (
                <div className="context-item danger" onClick={() => { deleteSpace(ctxMenu.space.id); setCtxMenu(null) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Delete Space
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}