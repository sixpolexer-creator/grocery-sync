'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, MapPin, Plus, ShoppingBag, Users } from 'lucide-react'
import { ItemRow } from './ItemRow'
import { AddItemBar } from './AddItemBar'
import { AddPartnerModal } from './AddPartnerModal'
import { MembersBar } from './MembersBar'
import { InStoreMode } from './InStoreMode'
import { FindMeModal } from './FindMeModal'

interface Item {
  id: string
  name: string
  quantity: number
  unit: string | null
  checked: boolean
  checked_by: string | null
  checked_at: string | null
  added_by: string
  created_at: string
}

interface Member {
  user_id: string
  role: string
  profiles: { username: string; avatar_url: string | null }
}

interface ListData {
  id: string
  name: string
  is_active: boolean
  owner_id: string
  list_members: Member[]
  items: Item[]
}

interface Props {
  list: ListData
  userId: string
}

export function ListDetailClient({ list: initialList, userId }: Props) {
  const [items, setItems]             = useState<Item[]>(initialList.items)
  const [members, setMembers]         = useState<Member[]>(initialList.list_members)
  const [showPartner, setShowPartner] = useState(false)
  const [inStoreMode, setInStoreMode] = useState(false)
  const [showFindMe, setShowFindMe]   = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Supabase Realtime subscription ──────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`list:${initialList.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'items', filter: `list_id=eq.${initialList.id}` },
        payload => setItems(prev => {
          if (prev.some(i => i.id === payload.new.id)) return prev
          return [...prev, payload.new as Item]
        })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items', filter: `list_id=eq.${initialList.id}` },
        payload => setItems(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new as Item } : i))
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'items', filter: `list_id=eq.${initialList.id}` },
        payload => setItems(prev => prev.filter(i => i.id !== payload.old.id))
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'list_members', filter: `list_id=eq.${initialList.id}` },
        async () => {
          const { data } = await supabase
            .from('list_members')
            .select('user_id, role, profiles(username, avatar_url)')
            .eq('list_id', initialList.id)
          if (data) setMembers(data as unknown as Member[])
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [initialList.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItem = async (item: Item) => {
    const newChecked = !item.checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked } : i))
    await supabase
      .from('items')
      .update({
        checked: newChecked,
        checked_by: newChecked ? userId : null,
        checked_at: newChecked ? new Date().toISOString() : null,
      })
      .eq('id', item.id)
  }

  const deleteItem = async (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await supabase.from('items').delete().eq('id', itemId)
  }

  const addItem = async (name: string, quantity: number, unit: string, productId?: string) => {
    const { data, error } = await supabase
      .from('items')
      .insert({ list_id: initialList.id, added_by: userId, name, quantity, unit: unit || null, product_id: productId ?? null })
      .select()
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as Item])
    }
  }

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)
  const isOwner   = initialList.owner_id === userId

  if (inStoreMode) {
    return (
      <InStoreMode
        listId={initialList.id}
        userId={userId}
        items={items}
        onExit={() => setInStoreMode(false)}
        onFinish={() => router.push('/history')}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => router.push('/lists')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.25rem' }}
        >
          <ArrowRight size={20} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          {initialList.name}
        </h1>
        {isOwner && (
          <button
            onClick={() => setShowPartner(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: 8,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            <Users size={14} />
            שותף
          </button>
        )}
        {items.length > 0 && (
          <>
            <button
              onClick={() => setShowFindMe(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', borderRadius: 8,
                border: '1px solid var(--accent-teal)',
                background: 'rgba(13,148,136,0.08)',
                color: 'var(--accent-teal)', fontSize: '0.8rem', cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <MapPin size={14} />
              מצא לי
            </button>
            <button
              onClick={() => setInStoreMode(true)}
              className="btn-accent"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', fontSize: '0.8rem',
              }}
            >
              <ShoppingBag size={14} />
              מצב קנייה
            </button>
          </>
        )}
      </div>

      {/* Members */}
      <MembersBar members={members} />

      {/* Add item */}
      <AddItemBar onAdd={addItem} />

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="bento-card" style={{ overflow: 'hidden' }}>
          {unchecked.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              userId={userId}
              onToggle={() => toggleItem(item)}
              onDelete={() => deleteItem(item.id)}
              borderTop={i > 0}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Plus size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.25 }} />
          <p style={{ fontSize: '0.9rem' }}>הרשימה ריקה — הוסף פריט למעלה</p>
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingRight: '0.25rem' }}>
            הושלם ({checked.length})
          </p>
          <div className="bento-card" style={{ overflow: 'hidden', opacity: 0.65 }}>
            {checked.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                userId={userId}
                onToggle={() => toggleItem(item)}
                onDelete={() => deleteItem(item.id)}
                borderTop={i > 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Find Me modal */}
      {showFindMe && (
        <FindMeModal listId={initialList.id} onClose={() => setShowFindMe(false)} />
      )}

      {/* Add partner modal */}
      {showPartner && (
        <AddPartnerModal
          listId={initialList.id}
          existingUserIds={members.map(m => m.user_id)}
          onClose={() => setShowPartner(false)}
        />
      )}
    </div>
  )
}
