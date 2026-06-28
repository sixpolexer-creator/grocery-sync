import { downloadBuffer, downloadText } from '../utils/http'
import { parseGovPriceXml } from '../parsers/xml-price'
import { parseGovPromoXml } from '../parsers/xml-promo'
import type { RetailerConnector, RawProduct, RawPromotion } from '../models/types'

export type { RetailerConnector }

/**
 * Base class for retailers that publish standard government XML price feeds
 * via the PublishPrice portal (most Israeli chains use this).
 */
export abstract class PublishPriceConnector implements RetailerConnector {
  abstract chainSlug: string
  abstract chainName: string
  readonly sourceType = 'publishprice' as const

  /** Override with the chain's PublishPrice index URL */
  abstract get priceIndexUrl(): string
  get promoIndexUrl(): string | null { return null }

  /** Override to extract the direct download URL from the index page HTML */
  protected extractPriceUrl(indexHtml: string): string | null {
    // Default: find the first .gz or .xml link containing "PriceFull"
    const match =
      indexHtml.match(/href=["']([^"']*PriceFull[^"']*(?:\.gz|\.xml|\.zip))["']/i) ??
      indexHtml.match(/href=["']([^"']*Price[^"']*(?:\.gz|\.xml))["']/i)
    return match ? match[1] : null
  }

  protected extractPromoUrl(indexHtml: string): string | null {
    const match = indexHtml.match(/href=["']([^"']*Promo[^"']*(?:\.gz|\.xml))["']/i)
    return match ? match[1] : null
  }

  async download(): Promise<Buffer> {
    const indexHtml = await downloadText(this.priceIndexUrl)
    let url = this.extractPriceUrl(indexHtml)
    if (!url) throw new Error(`${this.chainSlug}: could not find price file URL`)
    if (!url.startsWith('http')) url = new URL(url, this.priceIndexUrl).href
    return downloadBuffer(url)
  }

  async parse(raw: Buffer | string): Promise<RawProduct[]> {
    return parseGovPriceXml(raw, this.chainSlug, null)
  }

  async downloadPromos(): Promise<Buffer | string> {
    const indexUrl = this.promoIndexUrl
    if (!indexUrl) return ''
    const indexHtml = await downloadText(indexUrl)
    let url = this.extractPromoUrl(indexHtml)
    if (!url) return ''
    if (!url.startsWith('http')) url = new URL(url, indexUrl).href
    return downloadBuffer(url)
  }

  async parsePromos(raw: Buffer | string): Promise<RawPromotion[]> {
    if (!raw || (typeof raw === 'string' && !raw.trim())) return []
    return parseGovPromoXml(raw, this.chainSlug)
  }
}

/**
 * Base class for retailers with a direct XML URL (no index page needed).
 */
export abstract class DirectXmlConnector implements RetailerConnector {
  abstract chainSlug: string
  abstract chainName: string
  readonly sourceType = 'xml' as const

  abstract get xmlUrl(): string

  async download(): Promise<Buffer> {
    return downloadBuffer(this.xmlUrl)
  }

  async parse(raw: Buffer | string): Promise<RawProduct[]> {
    return parseGovPriceXml(raw, this.chainSlug, null)
  }
}
