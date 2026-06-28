import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile?.username) redirect('/onboarding')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      <Navbar username={profile.username} avatarUrl={profile.avatar_url} userId={user.id} />
      <div style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '1.5rem 1.25rem' }}>
        {children}
      </div>
    </div>
  )
}
