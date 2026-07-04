'use client'

import { useState } from 'react'
import { History, ShoppingBag, ChevronDown, ChevronUp, User, Trash2, Pencil, Camera, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TripRow } from '@/app/(app)/history/page'

interface Props {
  trips: TripRow[]
  userId: string
}

export function HistoryClient({ trips: initialTrips, userId }: Props) {
  const [trips, setTrips] = useState<TripRow[]>(initialTrips)
  const totalSpent = trips.reduce((s, t) => s + (t.total_amount ?? 0), 0)
  const tripsWithAmount = trips.filter(t => t.total_amount != null)

  const deleteTrip = async (trip: TripRow) => {
    if (!confirm('למחוק את הקנייה הזו לצמיתות?')) return
    const supabase = createClient()
    setTrips(prev => prev.filter(t => t.id !== trip.id))

    if (trip.receipt_image_url) {
      const path = extractStoragePath(trip.receipt_image_url)
      if (path) await supabase.storage.from('receipts').remove([path])
    }
    await supabase.from('shopping_trips').delete().eq('id', trip.id)
  }

  const updateAmount = async (tripId: string, newAmount: number | null) => {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, total_amount: newAmount } : t))
    const supabase = createClient()
    await supabase.from('shopping_trips').update({ total_amount: newAmount }).eq('id', tripId)
  }

  const updateReceiptImage = async (trip: TripRow, file: File) => {
    const supabase = createClient()
    const path = `${trip.lists?.id ?? 'unknown'}/${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, file)
    if (uploadErr) return

    const { data: publicUrl } = supabase.storage.from('receipts').getPublicUrl(path)
    const oldPath = trip.receipt_image_url ? extractStoragePath(trip.receipt_image_url) : null

    setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, receipt_image_url: publicUrl.publicUrl } : t))
    await supabase.from('shopping_trips').update({ receipt_image_url: publicUrl.publicUrl }).eq('id', trip.id)

    if (oldPath) await supabase.storage.from('receipts').remove([oldPath])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <History size={20} style={{ color: 'var(--accent-indigo)' }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>היסטוריית קניות</h1>
      </div>

      {/* Summary */}
      {trips.length > 0 && (
        <div className="bento-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
          <Stat label="סה״כ קניות" value={String(trips.length)} />
          <Stat label="סה״כ הוצאות" value={`₪${totalSpent.toFixed(2)}`} accent />
          <Stat
            label="ממוצע לקנייה"
            value={tripsWithAmount.length
              ? `₪${(totalSpent / tripsWithAmount.length).toFixed(2)}`
              : '—'}
          />
        </div>
      )}

      {/* Empty */}
      {trips.length === 0 && (
        <div className="bento-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShoppingBag size={40} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>אין היסטוריה עדיין</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>סיים קנייה דרך ״מצב קנייה״ כדי לראות נתונים כאן</p>
        </div>
      )}

      {/* Trip cards */}
      {trips.map(trip => (
        <TripCard
          key={trip.id}
          trip={trip}
          onDelete={() => deleteTrip(trip)}
          onUpdateAmount={amount => updateAmount(trip.id, amount)}
          onUpdateImage={file => updateReceiptImage(trip, file)}
        />
      ))}

    </div>
  )
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/receipts/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({
  trip,
  onDelete,
  onUpdateAmount,
  onUpdateImage,
}: {
  trip: TripRow
  onDelete: () => void
  onUpdateAmount: (amount: number | null) => void
  onUpdateImage: (file: File) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [amountInput, setAmountInput] = useState(trip.total_amount != null ? String(trip.total_amount) : '')
  const date = new Date(trip.created_at)
  const list = trip.lists
  const who  = trip.profiles

  const saveAmount = () => {
    onUpdateAmount(amountInput ? parseFloat(amountInput) : null)
    setEditing(false)
  }

  return (
    <div className="bento-card" style={{ overflow: 'hidden' }}>

      {/* Top row */}
      <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>

        {/* Left: date + list + who */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            {list?.name ?? 'רשימה שנמחקה'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span>
              {date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>
              {date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {who && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  <User size={11} />
                  {who.username}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Right: amount + expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {!editing && trip.total_amount != null && (
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-teal)' }}>
              ₪{trip.total_amount.toFixed(2)}
            </span>
          )}
          {trip.shopping_trip_items.length > 0 && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem',
              }}
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{trip.shopping_trip_items.length} פריטים</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit amount row */}
      {editing && (
        <div style={{ padding: '0 1.4rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
            autoFocus
            step="0.01"
            min="0"
            style={{
              flex: 1, padding: '0.5rem 0.75rem', borderRadius: 8,
              border: '1.5px solid var(--accent-teal)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', direction: 'ltr',
            }}
          />
          <button onClick={saveAmount} className="btn-accent" style={{ padding: '0.5rem 0.9rem', borderRadius: 8, fontSize: '0.8rem' }}>
            שמור
          </button>
          <button
            onClick={() => { setEditing(false); setAmountInput(trip.total_amount != null ? String(trip.total_amount) : '') }}
            style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            ביטול
          </button>
        </div>
      )}

      {/* Receipt image */}
      {trip.receipt_image_url && (
        <div style={{ padding: '0 1.4rem 1rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trip.receipt_image_url}
            alt="קבלה"
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, border: '1px solid var(--border)', display: 'block' }}
          />
        </div>
      )}

      {/* Action row */}
      <div style={{
        padding: '0.6rem 1.4rem', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '1.1rem', alignItems: 'center',
      }}>
        <button
          onClick={() => setEditing(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem' }}
        >
          <Pencil size={13} />
          ערוך סכום
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {trip.receipt_image_url ? <ImageIcon size={13} /> : <Camera size={13} />}
          {trip.receipt_image_url ? 'החלף תמונה' : 'הוסף תמונה'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onUpdateImage(file)
              e.target.value = ''
            }}
          />
        </label>

        <button
          onClick={onDelete}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', marginInlineStart: 'auto' }}
        >
          <Trash2 size={13} />
          מחק
        </button>
      </div>

      {/* Collapsible items */}
      {open && trip.shopping_trip_items.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '0.75rem 1.4rem 1rem',
          display: 'flex', flexDirection: 'column', gap: '0',
        }}>
          {trip.shopping_trip_items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: i < trip.shopping_trip_items.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {item.item_name}
                </span>
                {(item.brand || item.category) && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {[item.brand, item.category].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0, marginInlineStart: '0.75rem' }}>
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</p>
      <p style={{ fontSize: '1.3rem', fontWeight: 700, color: accent ? 'var(--accent-teal)' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  )
}
