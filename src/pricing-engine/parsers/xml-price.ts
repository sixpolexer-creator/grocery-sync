import { parseXmlItems, xmlStr, xmlNum, xmlDate } from '../utils/xml-stream'
import type { RawProduct } from '../models/types'

/**
 * Parses the Israeli government-mandated PriceFull XML format.
 * Schema is standardized across all retailers by the Consumer Protection Law.
 *
 * Key fields: ItemCode, ItemName, ManufacturerName, ItemPrice,
 *             UnitQty, Quantity, UnitOfMeasure, bIsWeighted, LastUpdateDate
 */
export function parseGovPriceXml(raw: Buffer | string, chainSlug: string, storeCode: string | null): RawProduct[] {
  const items = parseXmlItems(raw)
  const results: RawProduct[] = []

  for (const item of items) {
    const barcode     = xmlStr(item['ItemCode'] ?? item['Barcode'] ?? item['PLU'])
    const productName = xmlStr(item['ItemName'] ?? item['ProductName'] ?? item['Name'])
    if (!productName) continue

    const price = xmlNum(item['ItemPrice'] ?? item['Price'] ?? item['UnitPrice'])
    if (price <= 0) continue

    results.push({
      barcode:      barcode || null,
      productName,
      manufacturer: xmlStr(item['ManufacturerName'] ?? item['Manufacturer']) || null,
      chain:        chainSlug,
      storeCode,
      category:     xmlStr(item['ItemSection'] ?? item['Category']) || null,
      price,
      unitPrice:    xmlNum(item['UnitOfMeasurePrice'] ?? item['UnitPrice']) || null,
      unitMeasure:  xmlStr(item['UnitQty'] ?? item['UnitOfMeasure']) || null,
      quantity:     xmlNum(item['Quantity'] ?? item['QtyInPackage']) || null,
      isWeighted:   xmlStr(item['bIsWeighted'] ?? item['IsWeighted']) === '1',
      allowDiscount: xmlStr(item['AllowDiscount']) !== '0',
      updatedAt:    xmlDate(item['LastUpdateDate'] ?? item['UpdateDate']),
    })
  }

  return results
}
