import { downloadJson } from '../utils/http'
import { parseRamiLevyJson } from '../parsers/json-api'
import type { RetailerConnector, RawProduct } from '../models/types'

const BASE = 'https://www.rami-levy.co.il/api'

export class RamiLevyConnector implements RetailerConnector {
  chainSlug  = 'rami-levy'
  chainName  = 'רמי לוי'
  sourceType = 'api' as const

  async download(): Promise<string> {
    const data = await downloadJson<{ data?: unknown[] }>(
      `${BASE}/catalog?store=331&page=1&per_page=500`,
      { headers: { Accept: 'application/json', 'Accept-Language': 'he-IL' } }
    )
    return JSON.stringify(data)
  }

  async parse(raw: Buffer | string): Promise<RawProduct[]> {
    const data = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as { data?: unknown[] }
    return parseRamiLevyJson(data as Parameters<typeof parseRamiLevyJson>[0], '331')
  }
}
