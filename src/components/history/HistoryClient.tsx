'use client'

import { useState } from 'react'
import { History, ShoppingBag, ChevronDown, ChevronUp, User } from 'lucide-react'
import type { TripRow } from '@/app/(app)/history/page'

interface Props {
  trips: TripRow[]
  userId: string
}

export function HistoryClient({ trips, userId }: Props) {
  const totalSpent = trips.reduce((s, t) => s + (t.total_amount ?? 0), 0)
  const tripsWithAmount = trips.filter(t => t.total_amount != null)

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
        <TripCard key={trip.id} trip={trip} isOwn={trip.profiles?.username != null} />
      ))}

    </div>
  )
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: TripRow; isOwn: boolean }) {
  const [open, setOpen] = useState(false)
  const date = new Date(trip.created_at)
  const list = trip.lists
  const who  = trip.profiles

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
          {trip.total_amount != null && (
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
