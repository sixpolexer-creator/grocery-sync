'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Trash2 } from 'lucide-react'

interface Item {
  id: string
  name: string
  quantity: number
  unit: string | null
  checked: boolean
  image_url?: string | null
}

interface Props {
  item: Item
  userId: string
  estimatedPrice?: number | null
  onToggle: () => void
  onDelete: () => void
  borderTop?: boolean
}

export function ItemRow({ item, estimatedPrice, onToggle, onDelete, borderTop }: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <div
      className="item-enter"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.8rem 1rem',
        borderTop: borderTop ? '1px solid var(--border)' : 'none',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-glow)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      {/* Product thumbnail */}
      {item.image_url && !imageFailed ? (
        <div
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: 6,
            overflow: 'hidden',
            background: '#0f1115',
            border: '1px solid rgba(192,197,204,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: item.checked ? 0.4 : 1,
          }}
        >
          <Image
            src={item.image_url}
            alt=""
            width={36}
            height={36}
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div style={{ width: 36, height: 36, flexShrink: 0 }} />
      )}

      {/* Checkbox */}
      <button
        onClick={onToggle}
        aria-label={item.checked ? 'בטל סימון' : 'סמן כנרכש'}
        title={item.checked ? 'בטל סימון' : 'סמן כנרכש'}
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `1.5px solid ${item.checked ? 'var(--accent-teal)' : 'var(--border)'}`,
          background: item.checked ? 'var(--accent-teal)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {item.checked && <Check size={12} color="#fff" strokeWidth={3} />}
      </button>

      {/* Name + qty */}
      <span
        style={{
          flex: 1,
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          textDecoration: item.checked ? 'line-through' : 'none',
          opacity: item.checked ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {item.name}
      </span>

      {(item.quantity !== 1 || item.unit) && (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
        </span>
      )}

      {/* Estimated price badge */}
      {estimatedPrice != null && !item.checked && (
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'var(--accent-teal)',
            background: 'rgba(224,122,56,0.10)',
            border: '1px solid rgba(224,122,56,0.25)',
            borderRadius: 5,
            padding: '0.1rem 0.45rem',
            flexShrink: 0,
            letterSpacing: '0.01em',
          }}
          title="הערכת מחיר ממוצעת"
        >
          ~₪{estimatedPrice.toFixed(2)}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        aria-label={`הסר ${item.name} מהרשימה`}
        title="הסר פריט"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          padding: '0.2rem',
          borderRadius: 5,
          opacity: 0.4,
          transition: 'opacity 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = '1'; b.style.color = '#ef4444' }}
        onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = '0.4'; b.style.color = 'var(--text-muted)' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
