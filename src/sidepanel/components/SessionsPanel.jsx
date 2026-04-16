import React, { useState, useEffect } from 'react'
import useStore from '../store'

/**
 * Sessions panel — slides up from the bottom.
 * Save the current session (all spaces + tabs) or restore a previously saved one.
 */
export default function SessionsPanel({ onClose }) {
  const { sessions, saveSession, restoreSession, deleteSession, reloadSessions } = useStore()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { reloadSessions() }, [])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const sessionName = name.trim() || `Session ${new Date().toLocaleDateString()}`
    await saveSession(sessionName)
    setName('')
    setSaving(false)
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const tabCount = (s) => s.spaces.reduce((n, sp) => n + (sp.tabs?.length || 0), 0)

  return (
    <div className="sessions-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sessions-panel">
        <div className="sessions-header">
          <span className="sessions-title">Sessions</span>
          <button className="sessions-close" onClick={onClose}>×</button>
        </div>

        {/* Save current session */}
        <div className="sessions-save-bar">
          <input
            className="sessions-name-input"
            placeholder="Session name (optional)…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button className="sessions-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Now'}
          </button>
        </div>

        {/* Saved sessions list */}
        {sessions.length === 0 ? (
          <div className="sessions-empty">No saved sessions yet. Save one to get started.</div>
        ) : (
          <div className="sessions-list">
            {sessions.map((s) => (
              <div key={s.id} className="session-item">
                <div className="session-info">
                  <div className="session-name">{s.name}</div>
                  <div className="session-meta">
                    {formatDate(s.savedAt)} · {s.spaces.length} space{s.spaces.length !== 1 ? 's' : ''} · {tabCount(s)} tab{tabCount(s) !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="session-restore-btn"
                  onClick={() => { restoreSession(s.id); onClose() }}
                  title="Re-open all tabs from this session"
                >
                  Restore
                </button>
                <button
                  className="session-delete-btn"
                  onClick={() => deleteSession(s.id)}
                  title="Delete session"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}