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
  const { list_id } = body as { list_id: string }
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
  // Use market_name as chainId (no separate chain table)
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

  const chains = [...chainMetas.values()]

  if (chains.length === 0) {
    return NextResponse.json({
      singles: [], split: null,
      message: 'לא נמצאו רשתות במאגר',
    })
  }

  // ── 5. Score all chains, sort, take top 3 ────────────────────────────────
  const scored: SingleStoreResult[] = chains.map(chain => scoreSingleChain(chain, items))

  scored.sort((a, b) => {
    if (b.coveredItems !== a.coveredItems) return b.coveredItems - a.coveredItems
    return a.totalPrice - b.totalPrice
  })

  const top3 = scored.slice(0, 3)

  // ── 6. Optimize split basket ──────────────────────────────────────────────
  let split = optimizeSplitBasket(chains, items)

  if (split && top3.length > 0) {
    const bestSingle = top3[0].totalPrice
    split.savingsVsSingle = Math.round((bestSingle - split.totalPrice) * 100) / 100
    if (split.savingsVsSingle <= 0 || split.stops.length < 2) split = null
  }

  return NextResponse.json({ singles: top3, split } satisfies CompareResponse)
}
