import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ListDetailClient } from '@/components/lists/ListDetailClient'

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: list } = await supabase
    .from('lists')
    .select(`
      id, name, is_active, owner_id,
      list_members(user_id, role, profiles(username, avatar_url)),
      items(id, name, quantity, unit, checked, checked_by, checked_at, added_by, created_at)
    `)
    .eq('id', id)
    .single()

  if (!list) notFound()

  const isMember = (list.list_members as any[]).some((m: any) => m.user_id === user!.id)
  if (!isMember) notFound()

  return (
    <ListDetailClient
      list={list as any}
      userId={user!.id}
    />
  )
}
