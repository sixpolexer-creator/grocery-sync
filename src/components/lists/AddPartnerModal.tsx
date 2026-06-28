'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, UserPlus } from 'lucide-react'

interface Props {
  listId: string
  existingUserIds: string[]
  onClose: () => void
}

interface ProfileResult {
  id: string
  username: string
  avatar_url: string | null
}

export function AddPartnerModal({ listId, existingUserIds, onClose }: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<ProfileResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [added, setAdded]       = useState<Set<string>>(new Set())
  const [error, setError]       = useState<string | null>(null)
  const supabase = createClient()

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q.trim()}%`)
      .not('id', 'in', `(${existingUserIds.join(',')})`)
      .limit(8)
    setResults((data as ProfileResult[]) ?? [])
    setLoading(false)
  }

  const addPartner = async (profile: ProfileResult) => {
    setError(null)
    const { error: dbErr } = await supabase
      .from('list_members')
      .insert({ list_id: listId, user_id: profile.id, role: 'member' })

    if (dbErr) {
      setError('שגיאה בהוספת השותף')
      return
    }
    setAdded(prev => new Set(prev).add(profile.id))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bento-card"
        style={{ width: '100%', maxWidth: 420, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>הוסף שותף לרשימה</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="חפש לפי שם משתמש..."
            style={{
              width: '100%',
              padding: '0.65rem 2.2rem 0.65rem 0.75rem',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        {error && <p style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</p>}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
            {results.map(profile => (
              <div
                key={profile.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.75rem', borderRadius: 9,
                  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                }}
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
                ) : (
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent-glow)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent-indigo)',
                    }}
                  >
                    {profile.username[0].toUpperCase()}
                  </div>
                )}
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                  @{profile.username}
                </span>
                <button
                  onClick={() => addPartner(profile)}
                  disabled={added.has(profile.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.35rem 0.75rem', borderRadius: 7,
                    border: 'none',
                    background: added.has(profile.id) ? 'var(--accent-teal)' : 'var(--accent-indigo)',
                    color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: added.has(profile.id) ? 'default' : 'pointer',
                  }}
                >
                  <UserPlus size={12} />
                  {added.has(profile.id) ? 'נוסף' : 'הוסף'}
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>מחפש...</p>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            לא נמצאו משתמשים עם השם &quot;{query}&quot;
          </p>
        )}
      </div>
    </div>
  )
}
