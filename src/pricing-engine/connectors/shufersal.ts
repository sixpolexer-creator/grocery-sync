import { downloadJson } from '../utils/http'
import { parseShufersalJson } from '../parsers/json-api'
import { parseGovPromoXml } from '../parsers/xml-promo'
import type { RetailerConnector, RawProduct, RawPromotion } from '../models/types'

const BASE = 'https://prices.shufersal.co.il'

interface ShufersalApiResponse {
  items?: { itemCode?: string; itemName?: string; manufacturerName?: string; itemPrice?: string | number; unitOfMeasurePrice?: string | number; unitQty?: string; quantity?: string | number; bIsWeighted?: string | number; allowDiscount?: string | number; lastUpdateDate?: string }[]
  totalItems?: number
}

export class ShufersalConnector implements RetailerConnector {
  chainSlug  = 'shufersal'
  chainName  = 'שופרסל'
  sourceType = 'api' as const

  private storeCode = '001' // default Tel-Aviv store

  async download(): Promise<string> {
    // Shufersal exposes a paginated JSON API — fetch page 1 for now
    // Production: paginate until totalItems exhausted
    const data = await downloadJson<ShufersalApiResponse>(
      `${BASE}/FileObject/UpdateCategory?catID=0&storeId=${this.storeCode}&sort=0&order=0&page=1`,
      { headers: { Accept: 'application/json' } }
    )
    return JSON.stringify(data)
  }

  async parse(raw: Buffer | string): Promise<RawProduct[]> {
    const data = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as ShufersalApiResponse
    return parseShufersalJson(data, this.storeCode)
  }

  async downloadPromos(): Promise<string> {
    // Shufersal also publishes promo XML at the same base
    try {
      const res = await fetch(`${BASE}/FileObject/UpdateCategory?catID=2&storeId=${this.storeCode}&sort=0&order=0&page=1`)
      return res.ok ? res.text() : ''
    } catch { return '' }
  }

  async parsePromos(raw: Buffer | string): Promise<RawPromotion[]> {
    if (!raw || String(raw).trim().length < 10) return []
    return parseGovPromoXml(raw, this.chainSlug)
  }
}
