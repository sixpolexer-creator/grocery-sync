'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MapPin, ShoppingCart, AlertCircle, Loader2, Navigation, Store } from 'lucide-react'
import type { CompareResponse, SingleStoreResult, SplitStoreResult } from '@/app/api/shopping/compare/route'

interface Props {
  listId: string
  onClose: () => void
}

const MEDAL = ['🥇', '🥈', '🥉']

export function FindMeModal({ listId, onClose }: Props) {
  const [data, setData]             = useState<CompareResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [locating, setLocating]     = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)

  // Ashkelon/Ashdod southern district — used when GPS is unavailable
  const FALLBACK_COORDS = { lat: 31.6659, lon: 34.5714 }

  const fetchCompare = useCallback(async (coords?: { lat: number; lon: number }) => {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { list_id: listId }
      if (coords) { body.lat = coords.lat; body.lon = coords.lon; body.radius_km = 20 }
      const res = await fetch('/api/shopping/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json as CompareResponse)
      setMessage(json.message ?? null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => { fetchCompare() }, [fetchCompare])

  const requestLocation = () => {
    setLocating(true)
    if (!navigator.geolocation) {
      // No GPS support — use Ashkelon/Ashdod fallback
      setUsingFallback(true)
      setUserCoords(FALLBACK_COORDS)
      setLocating(false)
      fetchCompare(FALLBACK_COORDS)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setUserCoords(coords)
        setUsingFallback(false)
        setLocating(false)
        fetchCompare(coords)
      },
      () => {
        // GPS denied/timed out — fall back to Ashkelon
        setUsingFallback(true)
        setUserCoords(FALLBACK_COORDS)
        setLocating(false)
        fetchCompare(FALLBACK_COORDS)
      },
      { timeout: 8000 }
    )
  }

  const hasResults = data && (data.singles.length > 0 || data.split != null)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '1.25rem 1.25rem 0 0',
          padding: '1.5rem',
          width: '100%', maxWidth: 540,
          maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} color="var(--accent-teal)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              מצא לי את הזול ביותר
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={requestLocation}
              disabled={locating}
              title="סנן לפי מיקומי"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.65rem', borderRadius: 7,
                border: `1px solid ${userCoords ? 'var(--accent-teal)' : 'var(--border)'}`,
                background: userCoords ? 'rgba(13,148,136,0.1)' : 'none',
                color: userCoords ? 'var(--accent-teal)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              }}
            >
              {locating
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Navigation size={13} />
              }
              {userCoords ? 'מסונן' : 'קרוב אלי'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          {userCoords
            ? usingFallback
              ? 'מציג חנויות עד 20 ק״מ מאשקלון/אשדוד (מיקום בדיקה)'
              : 'מציג חנויות עד 20 ק״מ ממיקומך'
            : 'השוואת מחירים לפריטים המקושרים במאגר'}
        </p>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '2.5rem', color: 'var(--text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>מחפש מחירים...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !hasResults && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <ShoppingCart size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p style={{ fontSize: '0.85rem' }}>{message ?? 'אין נתונים זמינים'}</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
              הוסף פריטים מהחיפוש החכם כדי לקבל השוואת מחירים
            </p>
          </div>
        )}

        {/* Single-store options */}
        {!loading && data?.singles.map((opt, idx) => (
          <SingleCard
            key={opt.chain.chainId}
            opt={opt}
            idx={idx}
            expanded={expanded}
            onToggle={() => setExpanded(expanded === opt.chain.chainId ? null : opt.chain.chainId)}
          />
        ))}

        {/* Split basket */}
        {!loading && data?.split && (
          <SplitCard
            split={data.split}
            expanded={expanded === '__split__'}
            onToggle={() => setExpanded(expanded === '__split__' ? null : '__split__')}
          />
        )}

        {!loading && hasResults && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            לחץ על שרשרת לפירוט · מחירים מעודכנים יומי
          </p>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Single-store card ─────────────────────────────────────────────────────────

function SingleCard({ opt, idx, expanded, onToggle }: {
  opt: SingleStoreResult
  idx: number
  expanded: string | null
  onToggle: () => void
}) {
  const isOpen = expanded === opt.chain.chainId
  return (
    <div className="bento-card" style={{ padding: '1rem', cursor: 'pointer' }} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.4rem' }}>{MEDAL[idx] ?? '🏪'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
              {opt.chain.chainName}
            </span>
            {idx === 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 600, background: 'var(--accent-teal)', color: '#fff', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                הכי זול
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {opt.coveredItems}/{opt.totalItems} פריטים · {opt.coveragePct}% כיסוי
            {opt.distanceKm != null && (
              <span> · {opt.distanceKm < 1
                ? `${Math.round(opt.distanceKm * 1000)} מ׳`
                : `${opt.distanceKm} ק״מ`}
                {opt.nearestStoreCity ? ` (${opt.nearestStoreCity})` : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'left', flexShrink: 0 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: idx === 0 ? 'var(--accent-teal)' : 'var(--text-primary)' }}>
            ₪{opt.totalPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: '0.75rem', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${opt.coveragePct}%`, borderRadius: 2,
          background: idx === 0 ? 'var(--accent-teal)' : 'var(--accent-indigo)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {isOpen && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          {opt.breakdown.map(item => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0' }}>
              <span>{item.name} × {item.quantity}</span>
              <span>₪{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
          {opt.missingItems.length > 0 && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: 6, background: 'rgba(251,191,36,0.1)', fontSize: '0.75rem', color: '#f59e0b' }}>
              חסר: {opt.missingItems.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Split basket card ─────────────────────────────────────────────────────────

function SplitCard({ split, expanded, onToggle }: {
  split: SplitStoreResult
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="bento-card"
      style={{ padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--accent-indigo)' }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Store size={20} color="var(--accent-indigo)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
              {split.stops.map(s => s.chain.chainName).join(' + ')}
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, background: 'var(--accent-indigo)', color: '#fff', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
              2 עצירות
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            חיסכון של ₪{split.savingsVsSingle.toFixed(2)} לעומת חנות אחת
          </div>
        </div>
        <div style={{ textAlign: 'left', flexShrink: 0 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-indigo)' }}>
            ₪{split.totalPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {split.stops.map(stop => (
            <div key={stop.chain.chainId}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-indigo)', marginBottom: '0.3rem' }}>
                {stop.chain.chainName}
                {stop.distanceKm != null && (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginRight: '0.4rem' }}>
                    {stop.distanceKm < 1 ? `${Math.round(stop.distanceKm * 1000)} מ׳` : `${stop.distanceKm} ק״מ`}
                    {stop.nearestStoreCity ? ` (${stop.nearestStoreCity})` : ''}
                  </span>
                )}
              </div>
              {stop.items.map(item => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.15rem 0' }}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>₪{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                סה״כ: ₪{stop.subtotal.toFixed(2)}
              </div>
            </div>
          ))}
          {split.missingItems.length > 0 && (
            <div style={{ padding: '0.5rem', borderRadius: 6, background: 'rgba(251,191,36,0.1)', fontSize: '0.75rem', color: '#f59e0b' }}>
              חסר: {split.missingItems.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
