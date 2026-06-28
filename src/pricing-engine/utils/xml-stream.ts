import { XMLParser } from 'fast-xml-parser'

export interface ParseOptions {
  /** If the XML root wraps items under a specific key path, e.g. "root.Items.Item" */
  itemPath?: string
}

/**
 * Parse a full XML Buffer into an array of item objects.
 * Uses fast-xml-parser for broad compatibility with Israeli retailer XML schemas.
 */
export function parseXmlItems(raw: Buffer | string, options: ParseOptions = {}): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes:    false,
    attributeNamePrefix: '_',
    parseAttributeValue: true,
    parseTagValue:       true,
    trimValues:          true,
    isArray:             (name) => {
      const arrayTags = ['Item', 'Product', 'Row', 'PriceElement']
      return arrayTags.includes(name)
    },
  })

  const doc = parser.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'))

  if (options.itemPath) {
    const parts  = options.itemPath.split('.')
    let   cursor: unknown = doc
    for (const part of parts) {
      if (cursor && typeof cursor === 'object') {
        cursor = (cursor as Record<string, unknown>)[part]
      } else {
        return []
      }
    }
    return Array.isArray(cursor) ? (cursor as Record<string, unknown>[]) : []
  }

  // Auto-detect: find the first array value in the document
  return findFirstArray(doc) ?? []
}

function findFirstArray(obj: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 5 || !obj || typeof obj !== 'object') return null
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (Array.isArray(val) && val.length > 0) return val as Record<string, unknown>[]
    const nested = findFirstArray(val, depth + 1)
    if (nested) return nested
  }
  return null
}

/** Safely coerce an XML value to string */
export function xmlStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

/** Safely coerce an XML value to number */
export function xmlNum(val: unknown): number {
  const n = parseFloat(String(val ?? ''))
  return isNaN(n) ? 0 : n
}

/** Parse Israeli date formats: YYYY-MM-DD, DD/MM/YYYY, YYYYMMDDHHMMSS */
export function xmlDate(val: unknown): Date {
  const s = xmlStr(val)
  if (!s) return new Date()
  if (/^\d{14}$/.test(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}`)
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split('/')
    return new Date(`${y}-${m}-${d}`)
  }
  return new Date(s)
}
