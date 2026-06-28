'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { Plus, ShoppingCart, Trash2, ChevronLeft } from 'lucide-react'

interface ListRow {
  id: string
  name: string
  is_active: boolean
  created_at: string
  list_members: { user_id: string; role: string }[]
  items: { id: string; checked: boolean }[]
}

interface Props {
  initialLists: ListRow[]
  userId: string
}

export function ListsClient({ initialLists, userId }: Props) {
  const [lists, setLists]       = useState<ListRow[]>(initialLists)
  const [newName, setNewName]   = useState('')
  const [creating, setCreating] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const createList = async () => {
    if (!newName.trim()) return
    setCreating(true)

    const { data, error } = await supabase
      .from('lists')
      .insert({ name: newName.trim(), owner_id: userId })
      .select('id, name, is_active, created_at')
      .single()

    if (error) {
      toast(`שגיאה ביצירת רשימה: ${error.message} (${error.code})`)
    } else if (data) {
      setLists(prev => [{
        ...data,
        list_members: [{ user_id: userId, role: 'owner' }],
        items: [],
      }, ...prev])
      setNewName('')
      setShowInput(false)
    }
    setCreating(false)
  }

  const deleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('למחוק את הרשימה?')) return

    const { error } = await supabase.from('lists').delete().eq('id', listId)
    if (error) {
      toast(`שגיאה במחיקת רשימה: ${error.message}`)
    } else {
      setLists(prev => prev.filter(l => l.id !== listId))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          הרשימות שלי
        </h1>
        <button
          className="btn-accent"
          onClick={() => setShowInput(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} />
          רשימה חדשה
        </button>
      </div>

      {/* New list input */}
      {showInput && (
        <div className="bento-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()}
            placeholder="שם הרשימה..."
            style={{
              flex: 1, padding: '0.6rem 0.9rem', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            className="btn-accent"
            onClick={createList}
            disabled={creating || !newName.trim()}
            style={{ opacity: creating ? 0.6 : 1 }}
          >
            {creating ? '...' : 'צור'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {lists.length === 0 && !showInput && (
        <div className="bento-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShoppingCart size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>אין רשימות עדיין</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>צור רשימה ראשונה למעלה</p>
        </div>
      )}

      {/* Lists grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {lists.map(list => {
          const total   = list.items.length
          const checked = list.items.filter(i => i.checked).length
          const members = list.list_members.length
          const isOwner = list.list_members.some(m => m.user_id === userId && m.role === 'owner')

          return (
            <div
              key={list.id}
              className="bento-card"
              onClick={() => router.push(`/lists/${list.id}`)}
              style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: 'var(--accent-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ShoppingCart size={16} style={{ color: 'var(--accent-indigo)' }} />
                  </div>
                  <span style={{
                    fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {list.name}
                  </span>
                </div>
                {isOwner && (
                  <button
                    onClick={e => deleteList(list.id, e)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: '0.2rem', borderRadius: 6, display: 'flex', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {total > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    <span>{checked}/{total} פריטים</span>
                    <span>{Math.round((checked / total) * 100)}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${(checked / total) * 100}%`,
                      background: 'var(--accent-teal)', borderRadius: 99, transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {members} {members === 1 ? 'משתמש' : 'משתמשים'}
                </span>
                <ChevronLeft size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
