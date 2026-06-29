'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ProductSearch } from './ProductSearch'

interface Props {
  onAdd: (name: string, quantity: number, unit: string, productId?: string, imageUrl?: string) => Promise<void>
}

const UNITS = ['', 'יח׳', 'ק"ג', 'גר׳', 'ל׳', 'מ"ל', 'חבילה', 'צרור']

export function AddItemBar({ onAdd }: Props) {
  const [name, setName]           = useState('')
  const [productId, setProductId] = useState<string | undefined>(undefined)
  const [imageUrl, setImageUrl]   = useState<string | undefined>(undefined)
  const [quantity, setQuantity]   = useState('1')
  const [unit, setUnit]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    await onAdd(name.trim(), parseFloat(quantity) || 1, unit, productId, imageUrl)
    setName('')
    setProductId(undefined)
    setImageUrl(undefined)
    setQuantity('1')
    setUnit('')
    setExpanded(false)
    setLoading(false)
  }

  return (
    <div
      className="bento-card"
      style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <ProductSearch
          value={name}
          onChange={v => { setName(v); setExpanded(true); setProductId(undefined); setImageUrl(undefined) }}
          onSelect={(product, resolvedName) => {
            setName(resolvedName)
            setProductId(product?.id)
            setImageUrl(product?.image_url ?? undefined)
            setExpanded(true)
          }}
          placeholder="הוסף פריט לרשימה..."
        />
        <button
          onClick={submit}
          disabled={!name.trim() || loading}
          className="btn-accent"
          style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', opacity: (!name.trim() || loading) ? 0.5 : 1, flexShrink: 0 }}
        >
          <Plus size={18} />
        </button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min="0.1"
            step="0.5"
            style={{
              width: 64, padding: '0.45rem 0.6rem', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', textAlign: 'center',
            }}
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            style={{
              padding: '0.45rem 0.6rem', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
            }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u || 'יחידה'}</option>)}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>כמות ויחידה (אופציונלי)</span>
        </div>
      )}
    </div>
  )
}
