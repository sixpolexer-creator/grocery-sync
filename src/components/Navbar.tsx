'use client'

import { useTheme } from './ThemeProvider'
import { Moon, Sun, ShoppingCart, LogOut, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { FriendsPanel } from './FriendsPanel'
import Image from 'next/image'

interface NavbarProps {
  username?: string | null
  avatarUrl?: string | null
  userId: string
}

export function Navbar({ username, avatarUrl, userId }: NavbarProps) {
  const { theme, toggle } = useTheme()
  const router   = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 1.25rem',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            onClick={() => router.push('/lists')}
            aria-label="דף הבית - רשימות קניות"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
          >
            <Image
              src="/logo.jpeg"
              alt="GrocerySync"
              width={32}
              height={32}
              style={{ borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
              priority
            />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>GrocerySync</span>
          </button>
          {username && (
            <nav style={{ display: 'flex', gap: '0.25rem' }}>
              {[
                { href: '/lists',   label: 'רשימות',  icon: <ShoppingCart size={14} /> },
                { href: '/history', label: 'היסטוריה', icon: <History size={14} /> },
              ].map(link => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.65rem', borderRadius: 7,
                    border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                    fontWeight: pathname?.startsWith(link.href) ? 600 : 400,
                    background: pathname?.startsWith(link.href) ? 'var(--accent-glow)' : 'none',
                    color: pathname?.startsWith(link.href) ? 'var(--accent-indigo)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {link.icon}{link.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {username && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{username}</span>
          )}
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={username ?? ''} width={32} height={32}
              style={{ borderRadius: '50%', border: '1px solid var(--border)' }} />
          )}

          {/* Friends panel */}
          {username && <FriendsPanel userId={userId} />}

          <button
            onClick={toggle}
            aria-label="החלף מצב תצוגה"
            title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '0.35rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-indigo)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-indigo)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {username && (
            <button
              onClick={handleLogout}
              aria-label="התנתקות"
              title="התנתקות"
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '0.35rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
