'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, X } from 'lucide-react'

interface Product {
  id: string
  name: string
  brand: string | null
  category: string | null
  image_url: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (product: Product | null, name: string) => void
  placeholder?: string
}

export function ProductSearch({ value, onChange, onSelect, placeholder = 'חפש מוצר...' }: Props) {
  const [results, setResults]     = useState<Product[]>([])
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setResults([]); setOpen(false); return }

    let cancelled = false
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .rpc('search_products', { query: value.trim(), max_results: 20 })
      if (cancelled) return
      setResults(error ? [] : (data as Product[]) ?? [])
      setOpen(true)
      setLoading(false)
    }, 220)

    return () => { cancelled = true }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const p = results[activeIdx]
      onSelect(p, p.name)
      // Do NOT call onChange here — onSelect already sets name in parent,
      // and calling onChange would immediately reset productId to undefined.
      setOpen(false)
      setActiveIdx(-1)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute', insetInlineStart: '0.75rem', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setActiveIdx(-1) }}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '0.6rem',
            paddingInlineStart: '2.2rem',
            paddingInlineEnd: '2.2rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        {value && (
          <button
            onClick={() => { onChange(''); onSelect(null, ''); setResults([]); setOpen(false) }}
            style={{
              position: 'absolute', insetInlineEnd: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', padding: '0.2rem',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', insetInlineStart: 0, insetInlineEnd: 0, zIndex: 200,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          {loading && (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              מחפש...
            </div>
          )}

          {!loading && results.length === 0 && value.trim().length >= 2 && (
            <div
              style={{
                padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>לא נמצא — הוסף &quot;{value}&quot; ידנית</span>
              <button
                onClick={() => { onSelect(null, value); setOpen(false) }}
                style={{
                  background: 'var(--accent-glow)', color: 'var(--accent-indigo)',
                  border: 'none', borderRadius: 6, padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                הוסף
              </button>
            </div>
          )}

          {results.map((product, i) => (
            <button
              key={product.id}
              onClick={() => { onSelect(product, product.name); setOpen(false); setActiveIdx(-1) }}
              style={{
                width: '100%', textAlign: 'end', padding: '0.65rem 1rem',
                background: i === activeIdx ? 'var(--accent-glow)' : 'transparent',
                border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {product.name}
                </span>
                {product.brand && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{product.brand}</span>
                )}
              </div>
              {product.category && (
                <span
                  style={{
                    fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 99,
                    background: 'var(--bg-secondary)', color: 'var(--text-muted)', flexShrink: 0,
                  }}
                >
                  {product.category}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
