import { createClient } from '@/lib/supabase/server'
import { ListsClient } from '@/components/lists/ListsClient'

export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lists } = await supabase
    .from('lists')
    .select(`
      id, name, is_active, created_at,
      list_members(user_id, role),
      items(id, checked)
    `)
    .order('created_at', { ascending: false })

  return (
    <ListsClient
      initialLists={(lists as any[]) ?? []}
      userId={user!.id}
    />
  )
}
