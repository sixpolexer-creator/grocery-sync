'use client'

import { X } from 'lucide-react'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, height: '100%',
          width: 'min(80vw, 300px)', maxWidth: '100vw',
          background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          padding: '1rem', gap: '0.75rem',
          animation: 'drawer-slide-in 0.2s ease both',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            aria-label="סגור תפריט"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '0.35rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
