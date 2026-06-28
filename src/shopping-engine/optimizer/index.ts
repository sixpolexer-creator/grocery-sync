/**
 * Multi-store split basket optimizer.
 *
 * Given a set of items and a price map (product_id → chain_id → price),
 * finds:
 *   1. The single best chain (max coverage, min cost).
 *   2. The optimal 2-chain split (each item goes to whichever of the two
 *      chains is cheapest, subject to both chains covering ≥1 item).
 */

export interface ItemPricing {
  itemId: string
  name: string
  quantity: number
  productId: string
  /** chain_id → unit price */
  priceByChain: Map<string, number>
}

export interface ChainMeta {
  chainId: string
  chainSlug: string
  chainName: string
}

export interface SingleStoreResult {
  type: 'single'
  chain: ChainMeta
  totalPrice: number
  coveredItems: number
  totalItems: number
  coveragePct: number
  breakdown: Array<{ name: string; unitPrice: number; quantity: number; subtotal: number }>
  missingItems: string[]
  distanceKm?: number
  nearestStoreName?: string | null
  nearestStoreCity?: string | null
}

export interface SplitStoreResult {
  type: 'split'
  totalPrice: number
  totalItems: number
  coveredItems: number
  savingsVsSingle: number
  stops: Array<{
    chain: ChainMeta
    items: Array<{ name: string; unitPrice: number; quantity: number; subtotal: number }>
    subtotal: number
    distanceKm?: number
    nearestStoreName?: string | null
    nearestStoreCity?: string | null
  }>
  missingItems: string[]
}

export type BasketResult = SingleStoreResult | SplitStoreResult

/** Score a single chain against all items */
export function scoreSingleChain(
  chain: ChainMeta,
  items: ItemPricing[]
): SingleStoreResult {
  let total = 0
  let covered = 0
  const breakdown: SingleStoreResult['breakdown'] = []
  const missing: string[] = []

  for (const item of items) {
    const unitPrice = item.priceByChain.get(chain.chainId)
    if (unitPrice != null) {
      const subtotal = unitPrice * item.quantity
      total += subtotal
      covered++
      breakdown.push({ name: item.name, unitPrice, quantity: item.quantity, subtotal })
    } else {
      missing.push(item.name)
    }
  }

  const totalItems = items.length
  return {
    type: 'single',
    chain,
    totalPrice: round2(total),
    coveredItems: covered,
    totalItems,
    coveragePct: totalItems > 0 ? Math.round((covered / totalItems) * 100) : 0,
    breakdown,
    missingItems: missing,
  }
}

/**
 * Find the optimal 2-chain split.
 * For each item, pick whichever of chainA or chainB is cheaper.
 * Evaluate all C(n,2) pairs of chains; return the best.
 */
export function optimizeSplitBasket(
  chains: ChainMeta[],
  items: ItemPricing[]
): SplitStoreResult | null {
  if (chains.length < 2 || items.length === 0) return null

  let best: SplitStoreResult | null = null

  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      const a = chains[i]
      const b = chains[j]
      const candidate = scoreSplitPair(a, b, items)
      if (candidate.coveredItems === 0) continue
      if (!best || candidate.totalPrice < best.totalPrice) best = candidate
    }
  }

  return best
}

function scoreSplitPair(
  a: ChainMeta,
  b: ChainMeta,
  items: ItemPricing[]
): SplitStoreResult {
  const aItems: SplitStoreResult['stops'][0]['items'] = []
  const bItems: SplitStoreResult['stops'][0]['items'] = []
  const missing: string[] = []
  let aTotal = 0
  let bTotal = 0
  let covered = 0

  for (const item of items) {
    const pa = item.priceByChain.get(a.chainId)
    const pb = item.priceByChain.get(b.chainId)

    if (pa == null && pb == null) {
      missing.push(item.name)
      continue
    }
    covered++

    if (pa != null && (pb == null || pa <= pb)) {
      const sub = round2(pa * item.quantity)
      aTotal += sub
      aItems.push({ name: item.name, unitPrice: pa, quantity: item.quantity, subtotal: sub })
    } else {
      const sub = round2(pb! * item.quantity)
      bTotal += sub
      bItems.push({ name: item.name, unitPrice: pb!, quantity: item.quantity, subtotal: sub })
    }
  }

  const stops: SplitStoreResult['stops'] = []
  if (aItems.length > 0) stops.push({ chain: a, items: aItems, subtotal: round2(aTotal) })
  if (bItems.length > 0) stops.push({ chain: b, items: bItems, subtotal: round2(bTotal) })

  return {
    type: 'split',
    totalPrice: round2(aTotal + bTotal),
    totalItems: items.length,
    coveredItems: covered,
    savingsVsSingle: 0, // filled in by caller after comparing with best single
    stops,
    missingItems: missing,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
