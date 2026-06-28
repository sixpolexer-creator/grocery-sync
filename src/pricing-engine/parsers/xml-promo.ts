import { parseXmlItems, xmlStr, xmlNum, xmlDate } from '../utils/xml-stream'
import type { RawPromotion } from '../models/types'

/**
 * Parses the Israeli government-mandated Promo XML format.
 * Fields: PromotionId, PromotionDescription, ItemCode, DiscountedPrice,
 *         MinNoOfItemOfered, PromotionStartDate, PromotionEndDate
 */
export function parseGovPromoXml(raw: Buffer | string, chainSlug: string): RawPromotion[] {
  const items = parseXmlItems(raw)
  const results: RawPromotion[] = []

  for (const item of items) {
    const promoId     = xmlStr(item['PromotionId'] ?? item['PromoId'] ?? item['ID'])
    const description = xmlStr(item['PromotionDescription'] ?? item['Description'] ?? item['Remark'])
    if (!promoId || !description) continue

    // Promotions can apply to multiple barcodes; handle ItemCode as scalar or array
    const rawCodes = item['ItemCode'] ?? item['Barcode']
    const barcodes = Array.isArray(rawCodes)
      ? (rawCodes as unknown[]).map(c => xmlStr(c))
      : [xmlStr(rawCodes)]

    for (const barcode of barcodes) {
      results.push({
        barcode:       barcode || null,
        chain:         chainSlug,
        promoId,
        description,
        discountPrice: xmlNum(item['DiscountedPrice'] ?? item['PromoPrice']) || null,
        minQty:        xmlNum(item['MinNoOfItemOfered'] ?? item['MinQty']) || null,
        validFrom:     xmlDate(item['PromotionStartDate'] ?? item['StartDate']),
        validTo:       xmlDate(item['PromotionEndDate']   ?? item['EndDate']),
      })
    }
  }

  return results
}
