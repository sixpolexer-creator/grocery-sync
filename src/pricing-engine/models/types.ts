// ── Raw parsed product from a retailer feed ──────────────────────────────────
export interface RawProduct {
  barcode:      string | null
  productName:  string
  manufacturer: string | null
  chain:        string
  storeCode:    string | null
  category:     string | null
  price:        number
  unitPrice:    number | null
  unitMeasure:  string | null
  quantity:     number | null
  isWeighted:   boolean
  allowDiscount: boolean
  updatedAt:    Date
}

// ── Raw promotion from a retailer feed ───────────────────────────────────────
export interface RawPromotion {
  barcode:       string | null
  chain:         string
  promoId:       string
  description:   string
  discountPrice: number | null
  minQty:        number | null
  validFrom:     Date | null
  validTo:       Date | null
}

// ── Normalized product (unified model) ───────────────────────────────────────
export interface NormalizedProduct {
  barcode:          string | null
  name:             string
  normalizedName:   string
  manufacturer:     string | null
  normalizedMfr:    string | null
  category:         string | null
  unit:             string | null
  packageSize:      number | null
  packageUnit:      string | null
  chainSlug:        string
  storeCode:        string | null
  price:            number
  unitPrice:        number | null
  unitMeasure:      string | null
  isWeighted:       boolean
  updatedAt:        Date
}

// ── Retailer adapter contract ─────────────────────────────────────────────────
export type SourceType = 'api' | 'xml' | 'publishprice' | 'ftp'

export interface RetailerConnector {
  chainSlug:  string
  chainName:  string
  sourceType: SourceType
  download():                              Promise<Buffer | string>
  parse(raw: Buffer | string):             Promise<RawProduct[]>
  parsePromos?(raw: Buffer | string):      Promise<RawPromotion[]>
  downloadPromos?():                       Promise<Buffer | string>
}

// ── Sync report ───────────────────────────────────────────────────────────────
export interface ChainSyncResult {
  chainSlug:         string
  chainName:         string
  status:            'success' | 'partial' | 'failed'
  productsUpserted:  number
  pricesUpserted:    number
  promosUpserted:    number
  errors:            string[]
  durationMs:        number
}

export interface SyncReport {
  startedAt:        string
  finishedAt:       string
  totalProducts:    number
  totalPrices:      number
  totalPromos:      number
  chains:           ChainSyncResult[]
  errors:           string[]
}
