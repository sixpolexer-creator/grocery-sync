'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, ShoppingBag, X, CheckCircle2, Sparkles, Camera } from 'lucide-react'

interface Item {
  id: string
  name: string
  quantity: number
  unit: string | null
  checked: boolean
}

interface Member {
  user_id: string
  role: string
  profiles: { username: string; avatar_url: string | null }
}

interface Props {
  listId: string
  userId: string
  items: Item[]
  members: Member[]
  onExit: () => void
  onFinish: () => void
}

export function InStoreMode({ listId, userId, items: initialItems, members, onExit, onFinish }: Props) {
  const [items, setItems]           = useState<Item[]>(initialItems)
  const [showFinish, setShowFinish] = useState(false)

  const toggleItem = async (item: Item) => {
    const next = !item.checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: next } : i))
    const supabase = createClient()
    await supabase
      .from('items')
      .update({
        checked:    next,
        checked_by: next ? userId : null,
        checked_at: next ? new Date().toISOString() : null,
      })
      .eq('id', item.id)
  }

  const checkedCount = items.filter(i => i.checked).length
  const progress     = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0
  const checkedItems = items.filter(i => i.checked)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShoppingBag size={18} style={{ color: 'var(--accent-indigo)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>מצב קנייה</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-teal)', fontWeight: 600 }}>
          {checkedCount}/{items.length}
        </span>
        <button onClick={onExit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: progress === 100 ? 'var(--accent-teal)' : 'var(--accent-indigo)',
          transition: 'width 0.3s, background 0.3s',
        }} />
      </div>

      {/* Items */}
      <div style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem 1.1rem', borderRadius: 14, width: '100%',
              border: `1.5px solid ${item.checked ? 'var(--accent-teal)' : 'var(--border)'}`,
              background: item.checked ? 'rgba(13,148,136,0.07)' : 'var(--bg-card)',
              cursor: 'pointer', textAlign: 'right', transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              border: `2px solid ${item.checked ? 'var(--accent-teal)' : 'var(--border)'}`,
              background: item.checked ? 'var(--accent-teal)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {item.checked && <Check size={16} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{
              flex: 1, fontSize: '1.05rem', fontWeight: 500,
              color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: item.checked ? 'line-through' : 'none',
              transition: 'all 0.15s',
            }}>
              {item.name}
            </span>
            {(item.quantity !== 1 || item.unit) && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Finish button */}
      <div style={{ position: 'sticky', bottom: 0, padding: '1rem 1.25rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowFinish(true)}
          className="btn-accent"
          style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <CheckCircle2 size={18} />
          סיימתי לקנות
        </button>
      </div>

      {showFinish && (
        <FinishModal
          listId={listId}
          userId={userId}
          checkedItems={checkedItems}
          members={members}
          onClose={() => setShowFinish(false)}
          onDone={onFinish}
        />
      )}
    </div>
  )
}

// ── Finish modal ──────────────────────────────────────────────────────────────

function FinishModal({
  listId,
  userId,
  checkedItems,
  members,
  onClose,
  onDone,
}: {
  listId: string
  userId: string
  checkedItems: Item[]
  members: Member[]
  onClose: () => void
  onDone: () => void
}) {
  const [amount,  setAmount]  = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  // Selective receipt sharing — default to everyone on the list, buyer included
  const [sharedWith, setSharedWith] = useState<Set<string>>(
    new Set(members.map(m => m.user_id))
  )
  const otherMembers = members.filter(m => m.user_id !== userId)
  const toggleShared = (targetUserId: string) => {
    setSharedWith(prev => {
      const next = new Set(prev)
      if (next.has(targetUserId)) next.delete(targetUserId)
      else next.add(targetUserId)
      return next
    })
  }
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // 1. Upload receipt image, if provided
    let receiptImageUrl: string | null = null
    if (receiptFile) {
      const path = `${listId}/${Date.now()}-${receiptFile.name}`
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile)

      if (uploadErr) {
        setError('שגיאה בהעלאת התמונה')
        setSaving(false)
        return
      }
      const { data: publicUrl } = supabase.storage.from('receipts').getPublicUrl(path)
      receiptImageUrl = publicUrl.publicUrl
    }

    // 2. Create trip record
    const { data: trip, error: tripErr } = await supabase
      .from('shopping_trips')
      .insert({
        list_id:      listId,
        completed_by: userId,
        total_amount: amount ? parseFloat(amount) : null,
        receipt_image_url: receiptImageUrl,
      })
      .select('id')
      .single()

    if (tripErr || !trip) {
      setError('שגיאה בשמירת הנסיעה')
      setSaving(false)
      return
    }

    // 3. Map this trip to the selected participants (buyer always included)
    const participantIds = new Set(sharedWith)
    participantIds.add(userId)
    await supabase.from('shopping_trip_participants').insert(
      Array.from(participantIds).map(uid => ({ trip_id: trip.id, user_id: uid }))
    )

    // 4. Save all checked items as trip items
    if (checkedItems.length > 0) {
      await supabase.from('shopping_trip_items').insert(
        checkedItems.map(item => ({
          trip_id:   trip.id,
          item_name: item.name,
          quantity:  item.quantity,
          unit:      item.unit ?? null,
        }))
      )
    }

    // 5. Delete checked items from the active list
    const checkedIds = checkedItems.map(i => i.id)
    if (checkedIds.length > 0) {
      await supabase.from('items').delete().in('id', checkedIds)
    }

    setSaving(false)
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 110,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      padding: '1rem',
    }}>
      <div
        className="bento-card"
        style={{ width: '100%', maxWidth: 400, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {/* Icon + heading */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(45,212,191,0.15))',
            border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Sparkles size={26} style={{ color: 'var(--accent-indigo)' }} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            כמה שילמת על כל זה?
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {checkedItems.length > 0
              ? `${checkedItems.length} פריטים יועברו להיסטוריה`
              : 'הקנייה תישמר בהיסטוריה'}
          </p>
        </div>

        {/* Amount input */}
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
            fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-teal)', pointerEvents: 'none',
          }}>₪</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            autoFocus
            style={{
              width: '100%', padding: '0.9rem 2.5rem 0.9rem 0.9rem',
              borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontSize: '1.6rem', fontWeight: 700, outline: 'none',
              textAlign: 'center', direction: 'ltr',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent-teal)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Receipt photo upload */}
        <label
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.75rem', borderRadius: 10, cursor: 'pointer',
            border: '1.5px dashed var(--border)', background: 'var(--bg-secondary)',
            fontSize: '0.85rem', color: receiptFile ? 'var(--accent-teal)' : 'var(--text-muted)',
            fontWeight: receiptFile ? 600 : 400,
          }}
        >
          <Camera size={16} />
          {receiptFile ? receiptFile.name : 'צלם או העלה קבלה'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
        </label>

        {/* Selective receipt sharing */}
        {otherMembers.length > 0 && (
          <div
            style={{
              borderRadius: 12,
              background: '#161b22',
              border: '1px solid rgba(45,212,191,0.18)',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-teal)' }}>
              מי יראה את הקנייה הזו בהיסטוריה?
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {otherMembers.map(member => {
                const checked = sharedWith.has(member.user_id)
                return (
                  <label
                    key={member.user_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                      padding: '0.4rem 0.5rem', borderRadius: 8,
                      background: checked ? 'rgba(45,212,191,0.08)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShared(member.user_id)}
                      style={{ accentColor: 'var(--accent-teal)', width: 15, height: 15 }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#e6e9ef', fontWeight: checked ? 600 : 400 }}>
                      @{member.profiles.username}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Checked items preview */}
        {checkedItems.length > 0 && (
          <div style={{
            maxHeight: 140, overflowY: 'auto',
            background: 'var(--bg-secondary)', borderRadius: 10,
            padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem',
          }}>
            {checkedItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>{item.name}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', margin: 0 }}>{error}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: '0.8rem', borderRadius: 10,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-accent"
            style={{ flex: 2, padding: '0.8rem', borderRadius: 10, fontWeight: 700, opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'שומר...' : 'שמור וסיים ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
