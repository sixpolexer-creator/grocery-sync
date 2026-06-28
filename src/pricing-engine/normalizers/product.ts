import type { RawProduct, NormalizedProduct } from '../models/types'

// ── Unit normalization map ────────────────────────────────────────────────────
const UNIT_MAP: Record<string, string> = {
  'ק"ג': 'kg', "ק'ג": 'kg', 'קג': 'kg', 'kg': 'kg', 'kilo': 'kg',
  'גר': 'g', "גר'": 'g', 'gram': 'g', 'g': 'g',
  'ל': 'l', "ל'": 'l', 'ליטר': 'l', 'liter': 'l', 'l': 'l',
  'מל': 'ml', 'מ"ל': 'ml', 'ml': 'ml',
  'יח': 'unit', "יח'": 'unit', 'יחידה': 'unit', 'unit': 'unit',
  'חבילה': 'pack', 'pack': 'pack',
  'צרור': 'bunch', 'bunch': 'bunch',
}

// ── Category normalization map ────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  'מוצרי חלב': 'dairy',         'חלב': 'dairy',
  'בשר': 'meat',                'עוף': 'poultry',         'דגים': 'fish',
  'ירקות': 'produce',           'פירות': 'produce',       'ירקות ופירות': 'produce',
  'לחם': 'bakery',              'מאפים': 'bakery',        'לחם ומאפים': 'bakery',
  'שימורים': 'canned',
  'קטניות': 'legumes',
  'פסטה': 'pasta-rice',         'אורז': 'pasta-rice',
  'שמנים': 'oils',
  'תבלינים': 'condiments',      'רטבים': 'condiments',
  'חטיפים': 'snacks',           'עוגיות': 'snacks',
  'שתייה': 'beverages',         'משקאות': 'beverages',
  'קפה': 'coffee-tea',          'תה': 'coffee-tea',
  'מקפיא': 'frozen',            'קפוא': 'frozen',
  'ניקיון': 'household',        'טיפוח': 'personal-care',
  'ממתקים': 'sweets',           'שוקולד': 'sweets',
  'ביצים': 'eggs',
  'דגני בוקר': 'breakfast',
}

// ── Weight/size extraction from product name ──────────────────────────────────
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(ק"ג|קג|גר'|גר|ל'|ל|מ"ל|מל|kg|g|ml|l|יח'|יח)\b/i

function extractPackageInfo(name: string): { size: number | null; unit: string | null; cleanName: string } {
  const match = name.match(SIZE_RE)
  if (!match) return { size: null, unit: null, cleanName: name.trim() }
  const size     = parseFloat(match[1].replace(',', '.'))
  const unit     = normalizeUnit(match[2])
  const cleanName = name.replace(match[0], '').replace(/\s{2,}/g, ' ').trim()
  return { size, unit, cleanName }
}

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null
  return UNIT_MAP[raw.trim()] ?? raw.trim().toLowerCase()
}

export function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  return CATEGORY_MAP[t] ?? t
}

// ── Name normalization ────────────────────────────────────────────────────────
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s{2,}/g, ' ')      // collapse whitespace
    .replace(/[""״]/g, '"')       // normalize quotes
    .replace(/[''׳]/g, "'")       // normalize apostrophes
    .toLowerCase()
}

// ── Manufacturer normalization ────────────────────────────────────────────────
const MFR_ALIASES: Record<string, string> = {
  'תנובה': 'תנובה', 'tnuva': 'תנובה',
  'שטראוס': 'שטראוס', 'strauss': 'שטראוס',
  'אוסם': 'אוסם', 'osem': 'אוסם',
  'עלית': 'עלית', 'elite': 'עלית',
}

export function normalizeManufacturer(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  return MFR_ALIASES[t.toLowerCase()] ?? MFR_ALIASES[t] ?? t
}

// ── Main normalizer ───────────────────────────────────────────────────────────
export function normalizeProduct(raw: RawProduct): NormalizedProduct {
  const { size, unit, cleanName } = extractPackageInfo(raw.productName)

  return {
    barcode:        raw.barcode && raw.barcode.length >= 4 ? raw.barcode : null,
    name:           cleanName,
    normalizedName: normalizeName(cleanName),
    manufacturer:   raw.manufacturer,
    normalizedMfr:  normalizeManufacturer(raw.manufacturer),
    category:       normalizeCategory(raw.category),
    unit:           normalizeUnit(raw.unitMeasure) ?? unit,
    packageSize:    size,
    packageUnit:    unit,
    chainSlug:      raw.chain,
    storeCode:      raw.storeCode,
    price:          raw.price,
    unitPrice:      raw.unitPrice,
    unitMeasure:    normalizeUnit(raw.unitMeasure),
    isWeighted:     raw.isWeighted,
    updatedAt:      raw.updatedAt,
  }
}

export function normalizeProducts(raws: RawProduct[]): NormalizedProduct[] {
  return raws.map(normalizeProduct).filter(p => p.name.length > 0 && p.price > 0)
}
