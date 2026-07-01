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
        className="mobile-drawer-panel"
        style={{
          position: 'absolute', top: 0, right: 0, height: '100%',
          width: 'min(80vw, 320px)', maxWidth: '100vw',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          animation: 'drawer-slide-in 0.2s ease both',
        }}
      >
        <div style={{
          direction: 'rtl', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>תפריט</span>
          <button
            onClick={onClose}
            aria-label="סגור תפריט"
            className="mobile-drawer-item"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '0.35rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
