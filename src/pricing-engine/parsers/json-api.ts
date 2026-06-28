import type { RawProduct } from '../models/types'

// ── Shufersal JSON API ────────────────────────────────────────────────────────

interface ShufersalApiItem {
  itemCode?:          string
  itemName?:          string
  manufacturerName?:  string
  itemPrice?:         string | number
  unitOfMeasurePrice?: string | number
  unitQty?:           string
  quantity?:          string | number
  bIsWeighted?:       string | number
  allowDiscount?:     string | number
  lastUpdateDate?:    string
}

export function parseShufersalJson(data: { items?: ShufersalApiItem[] }, storeCode: string | null): RawProduct[] {
  return (data.items ?? []).map(item => ({
    barcode:       item.itemCode?.trim() || null,
    productName:   item.itemName?.trim() ?? '',
    manufacturer:  item.manufacturerName?.trim() || null,
    chain:         'shufersal',
    storeCode,
    category:      null,
    price:         parseFloat(String(item.itemPrice ?? 0)) || 0,
    unitPrice:     parseFloat(String(item.unitOfMeasurePrice ?? 0)) || null,
    unitMeasure:   item.unitQty?.trim() || null,
    quantity:      parseFloat(String(item.quantity ?? 0)) || null,
    isWeighted:    String(item.bIsWeighted) === '1',
    allowDiscount: String(item.allowDiscount) !== '0',
    updatedAt:     item.lastUpdateDate ? new Date(item.lastUpdateDate) : new Date(),
  })).filter(p => p.productName && p.price > 0)
}

// ── Rami Levy JSON API ────────────────────────────────────────────────────────

interface RamiLevyItem {
  id?:            number | string
  name?:          string
  price?:         { regular?: number; sale?: number } | number
  group?:         { name?: string }
  manufactured?:  string
}

export function parseRamiLevyJson(data: { data?: RamiLevyItem[] }, storeCode: string | null): RawProduct[] {
  const items = data.data ?? (Array.isArray(data) ? data as RamiLevyItem[] : [])
  return items.map(item => {
    const priceVal = typeof item.price === 'object' ? (item.price?.regular ?? 0) : (item.price ?? 0)
    return {
      barcode:       String(item.id ?? '').trim() || null,
      productName:   item.name?.trim() ?? '',
      manufacturer:  item.manufactured?.trim() || null,
      chain:         'rami-levy',
      storeCode,
      category:      item.group?.name?.trim() || null,
      price:         priceVal,
      unitPrice:     null,
      unitMeasure:   null,
      quantity:      null,
      isWeighted:    false,
      allowDiscount: true,
      updatedAt:     new Date(),
    }
  }).filter(p => p.productName && p.price > 0)
}
