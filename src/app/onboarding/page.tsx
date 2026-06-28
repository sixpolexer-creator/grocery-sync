'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Check } from 'lucide-react'

export default function OnboardingPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', user.id)

    if (dbError) {
      setError(dbError.message.includes('unique') ? 'שם המשתמש תפוס, נסה שם אחר' : 'שגיאה, נסה שוב')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const valid = /^[a-zA-Z0-9_]{3,30}$/.test(username)

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        padding: '1rem',
      }}
    >
      <div
        className="bento-card"
        style={{ width: '100%', maxWidth: 420, padding: '2.5rem 2rem' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <ShoppingCart size={24} style={{ color: 'var(--accent-indigo)' }} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            בחר שם משתמש
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            חברים יוכלו למצוא אותך לפי שם זה
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              dir="ltr"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                paddingLeft: valid ? '2.5rem' : '1rem',
                borderRadius: 10,
                border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)' }}
              onBlur={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : 'var(--border)' }}
            />
            {valid && (
              <Check
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--accent-teal)',
                }}
              />
            )}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            3–30 תווים: אותיות באנגלית, מספרים, קו תחתי בלבד
          </p>

          {error && (
            <p style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!valid || loading}
            className="btn-accent"
            style={{ opacity: (!valid || loading) ? 0.5 : 1, cursor: (!valid || loading) ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'שומר...' : 'המשך'}
          </button>
        </form>
      </div>
    </main>
  )
}
