import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from '@/components/history/HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()

  // Run auth and the trips query concurrently — the query only needs the
  // already-set session cookie, not the resolved user object, so there's no
  // reason to serialize these two round-trips.
  const [{ data: { user } }, { data: trips }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('shopping_trips')
      .select(`
        id, total_amount, created_at, receipt_image_url, completed_by,
        lists(id, name),
        profiles!completed_by(username, avatar_url),
        shopping_trip_items(id, item_name, quantity, unit, brand, category)
      `)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

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
