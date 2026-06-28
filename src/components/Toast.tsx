'use client'

import { createContext, useCallback, useContext, useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'

type ToastType = 'error' | 'success' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() { return useContext(Ctx) }

let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const colors: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  icon: <AlertCircle size={16} color="#ef4444" /> },
    success: { bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.4)', icon: <CheckCircle2 size={16} color="#2dd4bf" /> },
    info:    { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.4)', icon: <AlertCircle size={16} color="#6366f1" /> },
  }
  const c = colors[t.type]

  return (
    <div style={{
      pointerEvents: 'auto',
      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
      padding: '0.75rem 1rem',
      borderRadius: 12, border: `1px solid ${c.border}`, background: c.bg,
      backdropFilter: 'blur(12px)',
      maxWidth: 420, width: 'calc(100vw - 2rem)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      direction: 'rtl',
    }}>
      <span style={{ flexShrink: 0, marginTop: 2 }}>{c.icon}</span>
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {t.message}
      </span>
      <button
        onClick={() => onDismiss(t.id)}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
