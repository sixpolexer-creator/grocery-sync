import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedProduct } from '../models/types'
import type { RawPromotion } from '../models/types'
import { sanitizePrice, sanitizeDate } from '../normalizers/price'

const BATCH = 500

// ── Helper: chunk array into batches ─────────────────────────────────────────
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Ensure chain row exists ───────────────────────────────────────────────────
export async function ensureChain(
  supabase: SupabaseClient,
  chainSlug: string,
  chainName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('chains')
    .upsert({ slug: chainSlug, name: chainName }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`ensureChain(${chainSlug}): ${error?.message}`)
  return data.id as string
}

// ── Ensure store row exists ───────────────────────────────────────────────────
export async function ensureStore(
  supabase: SupabaseClient,
  chainId: string,
  storeCode: string
): Promise<string> {
  const { data, error } = await supabase
    .from('stores')
    .upsert({ chain_id: chainId, store_code: storeCode, name: storeCode }, { onConflict: 'chain_id,store_code' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`ensureStore(${storeCode}): ${error?.message}`)
  return data.id as string
}

// ── Upsert products — returns map of normalizedName → product id ──────────────
export async function upsertProducts(
  supabase: SupabaseClient,
  products: NormalizedProduct[]
): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0
  const errors: string[] = []

  const rows = products.map(p => ({
    barcode:          p.barcode,
    name:             p.name,
    normalized_name:  p.normalizedName,
    manufacturer:     p.normalizedMfr ?? p.manufacturer,
    category:         p.category,
    unit:             p.unit,
    package_size:     p.packageSize,
    package_unit:     p.packageUnit,
    updated_at:       new Date().toISOString(),
  }))

  for (const batch of chunks(rows, BATCH)) {
    // Barcode-keyed rows and name-keyed rows need separate upserts
    const withBarcode    = batch.filter(r => r.barcode)
    const withoutBarcode = batch.filter(r => !r.barcode)

    if (withBarcode.length > 0) {
      const { data: d1, error } = await supabase
        .from('products')
        .upsert(withBarcode, { onConflict: 'barcode', ignoreDuplicates: false })
        .select('id')
      if (error) errors.push(`products(barcode) upsert: ${error.message}`)
      else upserted += d1?.length ?? withBarcode.length
    }

    if (withoutBarcode.length > 0) {
      const { data: d2, error: e2 } = await supabase
        .from('products')
        .upsert(withoutBarcode, { onConflict: 'normalized_name', ignoreDuplicates: true })
        .select('id')
      if (e2) errors.push(`products(name) upsert: ${e2.message}`)
      else upserted += d2?.length ?? 0
    }
  }

  return { upserted, errors }
}

// ── Upsert prices ─────────────────────────────────────────────────────────────
export async function upsertPrices(
  supabase: SupabaseClient,
  products: NormalizedProduct[],
  storeId: string
): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0
  const errors: string[] = []

  // Fetch product IDs for this batch (by barcode or normalized_name)
  const barcodes = products.filter(p => p.barcode).map(p => p.barcode!)
  const names    = products.filter(p => !p.barcode).map(p => p.normalizedName)

  const idMap = new Map<string, string>() // key → product_id

  if (barcodes.length) {
    const { data } = await supabase.from('products').select('id, barcode').in('barcode', barcodes)
    for (const row of data ?? []) idMap.set(row.barcode, row.id)
  }
  if (names.length) {
    for (const batch of chunks(names, 500)) {
      const { data } = await supabase.from('products').select('id, normalized_name').in('normalized_name', batch)
      for (const row of data ?? []) idMap.set(row.normalized_name, row.id)
    }
  }

  const priceRows = products.flatMap(p => {
    const key       = p.barcode ?? p.normalizedName
    const productId = idMap.get(key)
    if (!productId) return []
    const price = sanitizePrice(p.price)
    if (!price) return []
    return [{
      product_id:    productId,
      store_id:      storeId,
      price,
      unit_price:    p.unitPrice ? sanitizePrice(p.unitPrice) : null,
      unit_measure:  p.unitMeasure,
      scraped_at:    new Date().toISOString(),
    }]
  })

  for (const batch of chunks(priceRows, 1000)) {
    const { data: dp, error } = await supabase
      .from('prices')
      .upsert(batch, { onConflict: 'product_id,store_id' })
      .select('product_id')
    if (error) errors.push(`prices upsert: ${error.message}`)
    else upserted += dp?.length ?? batch.length
  }

  return { upserted, errors }
}

// ── Upsert promotions ─────────────────────────────────────────────────────────
export async function upsertPromotions(
  supabase: SupabaseClient,
  promos: RawPromotion[],
  chainId: string
): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0
  const errors: string[] = []

  const rows = promos.map(p => ({
    chain_id:       chainId,
    promo_id:       p.promoId,
    barcode:        p.barcode,
    description:    p.description,
    discount_price: p.discountPrice ? sanitizePrice(p.discountPrice) : null,
    min_qty:        p.minQty,
    valid_from:     sanitizeDate(p.validFrom),
    valid_to:       sanitizeDate(p.validTo),
    scraped_at:     new Date().toISOString(),
  }))

  for (const batch of chunks(rows, BATCH)) {
    const { data: dpr, error } = await supabase
      .from('promotions')
      .upsert(batch, { onConflict: 'chain_id,promo_id,barcode' })
      .select('chain_id')
    if (error) errors.push(`promotions upsert: ${error.message}`)
    else upserted += dpr?.length ?? batch.length
  }

  return { upserted, errors }
}
