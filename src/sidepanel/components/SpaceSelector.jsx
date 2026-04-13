import React, { useState, useEffect } from 'react'
import useStore from '../store'

const EMOJI_OPTIONS = ['🏠', '💼', '🎮', '📚', '🎨', '✈️', '🔬', '💬', '🎵', '🍕', '⚡', '🌿']
const COLOR_OPTIONS = [
  '#8B7CF6', '#F87171', '#34D399', '#FBBF24', '#60A5FA',
  '#F472B6', '#A78BFA', '#FB923C', '#4ADE80', '#F9A8D4',
]

/**
 * Horizontal scrollable row of space pills with a "+" button
 * to create new spaces. Each pill shows emoji + name.
 *
 * @param {{ spaces: Array, activeSpaceId: string, createTrigger?: number }} props
 */
export default function SpaceSelector({ spaces, activeSpaceId, createTrigger }) {
  const { switchSpace, createSpace } = useStore()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🏠')
  const [color, setColor] = useState('#8B7CF6')

  // When createTrigger increments (from an external caller), open the form
  useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      setShowForm(true)
    }
  }, [createTrigger])

  const handleCreate = () => {
    if (name.trim()) {
      createSpace(name.trim(), emoji, color)
      setShowForm(false)
      setName('')
      setEmoji('🏠')
      setColor('#8B7CF6')
    }
  }

  return (
    <>
      <div className="space-selector">
        <div className="spaces-list">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`space-pill${space.id === activeSpaceId ? ' active' : ''}`}
              style={{ '--space-color': space.color }}
              onClick={() => switchSpace(space.id)}
              title={space.name}
            >
              <div className="space-dot" />
              {space.emoji} {space.name}
            </div>
          ))}
        </div>
        <button
          className="btn-add-space"
          onClick={() => setShowForm((v) => !v)}
          title="New Space"
        >
          {showForm ? '×' : '+'}
        </button>
      </div>

      {showForm && (
        <div className="new-space-form">
          <div className="new-space-row">
            <input
              className="space-name-input"
              placeholder="Space name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowForm(false)
                  setName('')
                }
              }}
              autoFocus
            />
          </div>

          <div className="new-space-emoji">
            {EMOJI_OPTIONS.map((em) => (
              <button
                key={em}
                className={`emoji-btn${emoji === em ? ' selected' : ''}`}
                onClick={() => setEmoji(em)}
              >
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

          <div className="new-space-actions">
            <button
              className="btn-sm secondary"
              onClick={() => {
                setShowForm(false)
                setName('')
              }}
            >
              Cancel
            </button>
            <button
              className="btn-sm primary"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </>
  )
}
