'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { Users, UserPlus, X, Check, Clock, User } from 'lucide-react'

interface Friend {
  id: string
  username: string
  avatar_url: string | null
  status: 'accepted' | 'pending'
  direction: 'sent' | 'received'
}

interface Props {
  userId: string
}

export function FriendsPanel({ userId }: Props) {
  const [open, setOpen]         = useState(false)
  const [friends, setFriends]   = useState<Friend[]>([])
  const [search, setSearch]     = useState('')
  const [adding, setAdding]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const supabase  = createClient()

  useEffect(() => {
    if (!open) return
    loadFriends()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const loadFriends = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id, requester:profiles!requester_id(username, avatar_url), addressee:profiles!addressee_id(username, avatar_url)')
    if (error) {
      toast(`שגיאה בטעינת חברים: ${error.message}`)
    } else {
      const list: Friend[] = (data ?? []).map((f: any) => {
        const isSender = f.requester_id === userId
        const other = isSender ? f.addressee : f.requester
        return {
          id: f.id,
          username: other?.username ?? '?',
          avatar_url: other?.avatar_url ?? null,
          status: f.status,
          direction: isSender ? 'sent' : 'received',
        }
      })
      setFriends(list)
    }
    setLoading(false)
  }

  const addFriend = async () => {
    const name = search.trim()
    if (!name) return
    setAdding(true)

    // look up profile by username
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', name)
      .single()

    if (pErr || !profile) {
      toast(`משתמש "${name}" לא נמצא`)
      setAdding(false)
      return
    }
    if (profile.id === userId) {
      toast('לא ניתן להוסיף את עצמך')
      setAdding(false)
      return
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: profile.id })

    if (error) {
      if (error.code === '23505') toast('כבר שלחת בקשת חברות למשתמש זה')
      else toast(`שגיאה: ${error.message}`)
    } else {
      toast('בקשת חברות נשלחה!', 'success')
      setSearch('')
      loadFriends()
    }
    setAdding(false)
  }

  const acceptFriend = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    if (error) toast(`שגיאה: ${error.message}`)
    else loadFriends()
  }

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) toast(`שגיאה: ${error.message}`)
    else setFriends(prev => prev.filter(f => f.id !== friendshipId))
  }

  const accepted = friends.filter(f => f.status === 'accepted')
  const pending  = friends.filter(f => f.status === 'pending')

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="חברים"
        style={{
          position: 'relative',
          background: open ? 'var(--accent-glow)' : 'none',
          border: `1px solid ${open ? 'var(--accent-indigo)' : 'var(--border)'}`,
          borderRadius: 8, padding: '0.35rem',
          cursor: 'pointer', color: open ? 'var(--accent-indigo)' : 'var(--text-muted)',
          display: 'flex', transition: 'all 0.15s',
        }}
      >
        <Users size={16} />
        {pending.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--accent-indigo)', color: '#fff',
            fontSize: '0.6rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {pending.length}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="bento-card"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            width: 300, maxHeight: 480, overflowY: 'auto',
            zIndex: 200, padding: '1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column', gap: '1rem',
            direction: 'rtl',
          }}
        >
          {/* Title */}
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>
            רשימת חברים
          </p>

          {/* Add friend */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFriend()}
              placeholder="שם משתמש..."
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
              }}
            />
            <button
              onClick={addFriend}
              disabled={adding || !search.trim()}
              className="btn-accent"
              style={{ padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', opacity: adding ? 0.6 : 1 }}
            >
              <UserPlus size={13} />
              הוסף
            </button>
          </div>

          {loading && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>טוען...</p>
          )}

          {/* Pending requests */}
          {pending.length > 0 && (
            <section>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                בקשות ממתינות
              </p>
              {pending.map(f => (
                <FriendRow
                  key={f.id}
                  friend={f}
                  onAccept={f.direction === 'received' ? () => acceptFriend(f.id) : undefined}
                  onRemove={() => removeFriend(f.id)}
                />
              ))}
            </section>
          )}

          {/* Accepted friends */}
          {accepted.length > 0 && (
            <section>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                חברים ({accepted.length})
              </p>
              {accepted.map(f => (
                <FriendRow key={f.id} friend={f} onRemove={() => removeFriend(f.id)} />
              ))}
            </section>
          )}

          {!loading && friends.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0.5rem 0' }}>
              אין חברים עדיין
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FriendRow({ friend: f, onAccept, onRemove }: {
  friend: Friend
  onAccept?: () => void
  onRemove: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.45rem 0.25rem',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'var(--accent-glow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {f.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={f.avatar_url} alt={f.username} width={30} height={30} style={{ borderRadius: '50%' }} />
          : <User size={14} style={{ color: 'var(--accent-indigo)' }} />
        }
      </div>
      <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)' }}>
        @{f.username}
      </span>
      {f.status === 'pending' && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Clock size={11} />
          {f.direction === 'sent' ? 'נשלח' : 'ממתין'}
        </span>
      )}
      {onAccept && (
        <button
          onClick={onAccept}
          title="אשר בקשה"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2dd4bf', display: 'flex', padding: '0.15rem' }}
        >
          <Check size={15} />
        </button>
      )}
      <button
        onClick={onRemove}
        title="הסר"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.15rem' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
