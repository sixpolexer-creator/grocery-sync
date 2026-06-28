'use client'

interface Member {
  user_id: string
  role: string
  profiles: { username: string; avatar_url: string | null }
}

interface Props {
  members: Member[]
}

export function MembersBar({ members }: Props) {
  if (members.length <= 1) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>שותפים:</span>
      {members.map(m => (
        <div
          key={m.user_id}
          title={`@${m.profiles.username}${m.role === 'owner' ? ' (בעלים)' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          {m.profiles.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.profiles.avatar_url}
              alt={m.profiles.username}
              width={24}
              height={24}
              style={{ borderRadius: '50%', border: '1.5px solid var(--border)' }}
            />
          ) : (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--accent-indigo)',
              }}
            >
              {m.profiles.username[0].toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            @{m.profiles.username}
          </span>
          {m.role === 'owner' && (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-indigo)', marginRight: '0.1rem' }}>★</span>
          )}
        </div>
      ))}
    </div>
  )
}
