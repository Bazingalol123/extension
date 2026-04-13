import React, { useState } from 'react'

/**
 * Reusable favicon component with image fallback.
 * Shows the favicon image if available, otherwise displays
 * a colored div with the first letter of the title.
 */
export default function Favicon({ src, title, size = 16, className = '' }) {
  const [imgError, setImgError] = useState(false)

  const initial = (title || '?')[0].toUpperCase()
  const validSrc = src && !imgError

  if (validSrc) {
    return (
      <img
        className={className}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 3, objectFit: 'contain' }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className={className || 'tab-favicon-fallback'}
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.53),
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
      }}
    >
      {initial}
    </div>
  )
}
