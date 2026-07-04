import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/history/HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all trips for lists the user is a member of
  const { data: trips } = await supabase
    .from('shopping_trips')
    .select(`
      id, total_amount, created_at, receipt_image_url, completed_by,
      lists(id, name),
      profiles!completed_by(username, avatar_url),
      shopping_trip_items(id, item_name, quantity, unit, brand, category)
    `)
    .order('created_at', { ascending: false })

  return <HistoryClient trips={(trips ?? []) as unknown as TripRow[]} userId={user!.id} />
}

export interface TripRow {
  id: string
  total_amount: number | null
  created_at: string
  receipt_image_url: string | null
  completed_by: string
  lists: { id: string; name: string } | null
  profiles: { username: string; avatar_url: string | null } | null
  shopping_trip_items: Array<{
    id: string
    item_name: string
    quantity: number
    unit: string | null
    brand: string | null
    category: string | null
  }>
}
