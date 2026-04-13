import React, { useEffect, useRef } from 'react'

/**
 * Floating context menu component.
 * Positioned at mouse coordinates, closes on click outside or Escape.
 *
 * @param {object} props
 * @param {{ x: number, y: number }} props.position - Screen coordinates
 * @param {Array<{ label: string, onClick: Function, icon?: React.ReactNode, danger?: boolean, separator?: boolean, submenu?: Array }>} props.items
 * @param {Function} props.onClose - Called when menu should close
 */
export default function ContextMenu({ position, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  if (!position) return null

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: position.y, left: position.x }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="context-separator" />
        }

        return (
          <div
            key={i}
            className={`context-item${item.danger ? ' danger' : ''}`}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
          >
            {item.icon && item.icon}
            {item.label}
            {item.shortcut && (
              <span className="ctx-shortcut">{item.shortcut}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
