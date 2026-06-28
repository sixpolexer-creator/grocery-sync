'use client'

import { ShoppingCart, Users, History, Search } from 'lucide-react'

interface Props {
  userId: string
  username: string
}

export function DashboardShell({ username }: Props) {
  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '2rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Greeting */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          שלום, {username} 👋
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          מה קונים היום?
        </p>
      </div>

      {/* Bento grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <BentoCard
          icon={<ShoppingCart size={22} />}
          title="רשימות קניות"
          description="ניהול ועריכת רשימות בזמן אמת"
          accent="var(--accent-indigo)"
          badge="בקרוב — Phase 2"
        />
        <BentoCard
          icon={<Users size={22} />}
          title="חברים"
          description="הוסף שותפים לרשימות ותראה מי מחובר"
          accent="var(--accent-teal)"
          badge="בקרוב — Phase 2"
        />
        <BentoCard
          icon={<Search size={22} />}
          title="חיפוש מוצרים"
          description="מאגר מוצרים ישראלי עם השלמה אוטומטית"
          accent="var(--accent-indigo)"
          badge="בקרוב — Phase 4"
        />
        <BentoCard
          icon={<History size={22} />}
          title="היסטוריית קניות"
          description="מעקב הוצאות וסריקת קבלות"
          accent="var(--accent-teal)"
          badge="בקרוב — Phase 3"
        />
      </div>
    </main>
  )
}

function BentoCard({
  icon,
  title,
  description,
  accent,
  badge,
}: {
  icon: React.ReactNode
  title: string
  description: string
  accent: string
  badge?: string
}) {
  return (
    <div
      className="bento-card"
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${accent}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.3rem' }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{description}</p>
      </div>
      {badge && (
        <span
          style={{
            alignSelf: 'flex-start',
            fontSize: '0.7rem',
            padding: '0.2rem 0.6rem',
            borderRadius: 99,
            background: `${accent}14`,
            color: accent,
            fontWeight: 500,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
