import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  scoreSingleChain,
  optimizeSplitBasket,
  type ItemPricing,
  type ChainMeta,
  type SingleStoreResult,
  type SplitStoreResult,
} from '@/shopping-engine/optimizer'

// ── Public types (consumed by FindMeModal) ────────────────────────────────────

export type { SingleStoreResult, SplitStoreResult }

export interface CompareResponse {
  singles: SingleStoreResult[]
  split: SplitStoreResult | null
  message?: string
}

// ── Store location data (nearest branch per chain in Ashkelon/Ashdod area) ───

interface StoreLocation {
  lat: number
  lon: number
  city: string
}

const CHAIN_STORES: Record<string, StoreLocation[]> = {
  'שופרסל':     [{ lat: 31.6623, lon: 34.5680, city: 'אשקלון' }, { lat: 31.8012, lon: 34.6480, city: 'אשדוד' }],
  'רמי לוי':    [{ lat: 31.6455, lon: 34.5598, city: 'אשקלון' }],
  'ויקטורי':    [{ lat: 31.7968, lon: 34.6524, city: 'אשדוד' }],
  'חצי חינם':   [{ lat: 31.8044, lon: 34.6503, city: 'אשדוד' }],
  'אושר עד':    [{ lat: 31.8088, lon: 34.6453, city: 'אשדוד' }],
  'טיב טעם':    [{ lat: 31.7956, lon: 34.6478, city: 'אשדוד' }],
  'מחסני השוק': [{ lat: 31.8011, lon: 34.6531, city: 'אשדוד' }],
  'קרפור':      [{ lat: 31.8033, lon: 34.6489, city: 'אשדוד' }],
  'פרשמרקט':   [{ lat: 31.6096, lon: 34.7718, city: 'קרית גת' }],
  'יוחננוף':    [{ lat: 31.2525, lon: 34.7915, city: 'באר שבע' }],
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Returns the nearest store for a chain; null if none within radiusKm. */
function nearestStore(
  chainName: string,
  userLat: number,
  userLon: number,
  radiusKm: number,
): { distanceKm: number; city: string } | null {
  const branches = CHAIN_STORES[chainName]
  if (!branches) return null
  let best: { distanceKm: number; city: string } | null = null
  for (const b of branches) {
    const d = Math.round(haversineKm(userLat, userLon, b.lat, b.lon) * 10) / 10
    if (d <= radiusKm && (!best || d < best.distanceKm)) {
      best = { distanceKm: d, city: b.city }
    }
  }
  return best
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { list_id, lat, lon, radius_km } = body as {
    list_id: string
    lat?: number
    lon?: number
    radius_km?: number
  }
  if (!list_id) return NextResponse.json({ error: 'list_id required' }, { status: 400 })

  // Auth check: user must be a member of the list
  const { data: member } = await supabase
    .from('list_members')
    .select('user_id')
    .eq('list_id', list_id)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── 1. Fetch unchecked items that have a product link ─────────────────────
  const { data: rawItems, error: itemErr } = await supabase
    .from('items')
    .select('id, name, quantity, product_id')
    .eq('list_id', list_id)
    .eq('checked', false)
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })

  const itemsWithProduct = (rawItems ?? []).filter(i => i.product_id)
  if (itemsWithProduct.length === 0) {
    return NextResponse.json({
      singles: [], split: null,
      message: 'אין פריטים מקושרים למוצרים במאגר',
    })
  }

  const productIds = itemsWithProduct.map(i => i.product_id as string)

  // ── 2. Fetch market_prices for these products ─────────────────────────────
  const { data: priceRows, error: priceErr } = await supabase
    .from('market_prices')
    .select('product_id, market_name, price')
    .in('product_id', productIds)

  if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 500 })

  if (!priceRows || priceRows.length === 0) {
    return NextResponse.json({
      singles: [], split: null,
      message: 'לא נמצאו מחירים במאגר',
    })
  }

  // ── 3. Build product_id → market_name → price map ────────────────────────
  const productChainPrice = new Map<string, Map<string, number>>()
  const chainMetas = new Map<string, ChainMeta>()

  for (const row of priceRows) {
    const { product_id, market_name, price } = row as {
      product_id: string
      market_name: string
      price: number
    }

    if (!chainMetas.has(market_name)) {
      chainMetas.set(market_name, {
        chainId: market_name,
        chainSlug: market_name,
        chainName: market_name,
      })
    }

    if (!productChainPrice.has(product_id)) {
      productChainPrice.set(product_id, new Map())
    }
    const chainMap = productChainPrice.get(product_id)!
    const existing = chainMap.get(market_name)
    if (existing == null || price < existing) chainMap.set(market_name, price)
  }

  // ── 4. Build ItemPricing objects ──────────────────────────────────────────
  const items: ItemPricing[] = itemsWithProduct.map(item => ({
    itemId: item.id,
    name: item.name,
    quantity: item.quantity ?? 1,
    productId: item.product_id!,
    priceByChain: productChainPrice.get(item.product_id!) ?? new Map(),
  }))

  let chains = [...chainMetas.values()]

  if (chains.length === 0) {
    return NextResponse.json({
      singles: [], split: null,
      message: 'לא נמצאו רשתות במאגר',
    })
  }

  // ── 5. Geolocation filtering ──────────────────────────────────────────────
  // Use provided coordinates or fall back to Ashkelon center for testing
  const userLat  = typeof lat === 'number' ? lat  : 31.6659
  const userLon  = typeof lon === 'number' ? lon  : 34.5714
  const radius   = typeof radius_km === 'number' ? radius_km : (lat != null ? 20 : Infinity)
  const geoActive = lat != null // only show distance info when user opted in

  // Build per-chain distance info
  const chainDistance = new Map<string, { distanceKm: number; city: string } | null>()
  if (geoActive) {
    for (const chain of chains) {
      chainDistance.set(chain.chainId, nearestStore(chain.chainName, userLat, userLon, radius))
    }
    // Filter: only keep chains that have a branch within radius
    chains = chains.filter(c => chainDistance.get(c.chainId) != null)
  }

  // ── 6. Score all chains, sort, take top 3 ────────────────────────────────
  const scored: SingleStoreResult[] = chains.map(chain => {
    const result = scoreSingleChain(chain, items)
    if (geoActive) {
      const loc = chainDistance.get(chain.chainId)
      result.distanceKm = loc?.distanceKm
      result.nearestStoreCity = loc?.city ?? null
    }
    return result
  })

  scored.sort((a, b) => {
    if (b.coveredItems !== a.coveredItems) return b.coveredItems - a.coveredItems
    return a.totalPrice - b.totalPrice
  })

  const top3 = scored.slice(0, 3)

  // ── 7. Optimize split basket ──────────────────────────────────────────────
  let split = optimizeSplitBasket(chains, items)

  if (split) {
    if (geoActive) {
      split.stops = split.stops.map(stop => {
        const loc = chainDistance.get(stop.chain.chainId)
        return { ...stop, distanceKm: loc?.distanceKm, nearestStoreCity: loc?.city ?? null }
      })
    }
    if (top3.length > 0) {
      const bestSingle = top3[0].totalPrice
      split.savingsVsSingle = Math.round((bestSingle - split.totalPrice) * 100) / 100
      if (split.savingsVsSingle <= 0 || split.stops.length < 2) split = null
    }
  }

  return NextResponse.json({ singles: top3, split } satisfies CompareResponse)
}
