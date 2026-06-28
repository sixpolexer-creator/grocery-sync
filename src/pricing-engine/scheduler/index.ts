import type { SupabaseClient } from '@supabase/supabase-js'
import type { RetailerConnector, ChainSyncResult, SyncReport } from '../models/types'
import { normalizeProducts } from '../normalizers/product'
import { ensureChain, ensureStore, upsertProducts, upsertPrices, upsertPromotions } from '../database/upsert'

// ── Retailer registry ─────────────────────────────────────────────────────────
// To add a new retailer: import its class, add one line to REGISTRY.
import { ShufersalConnector }          from '../connectors/shufersal'
import { RamiLevyConnector }           from '../connectors/rami-levy'
import { VictoryConnector }            from '../connectors/victory'
import { CarrefourConnector }          from '../connectors/carrefour'
import { OsherAdConnector }            from '../connectors/osher-ad'
import { YohananofConnector }          from '../connectors/yohananof'
import { TivTaamConnector }            from '../connectors/tiv-taam'
import { YeinotBitanConnector }        from '../connectors/yeinot-bitan'
import { MahsaneiHashukConnector }     from '../connectors/mahsanei-hashuk'
import { HatziHinamConnector }         from '../connectors/hatzi-hinam'
import { KeshetTeamimConnector }       from '../connectors/keshet-teamim'
import { FreshMarketConnector }        from '../connectors/fresh-market'
import { StopMarketConnector }         from '../connectors/stop-market'
import { ShukHairConnector }           from '../connectors/shuk-hair'
import { SuperBareketConnector }       from '../connectors/super-bareket'
import { KingStoreConnector }          from '../connectors/king-store'
import { SalachDabachConnector }       from '../connectors/salach-dabach'
import { Maayan2000Connector }         from '../connectors/maayan-2000'
import { ZolVebegadolConnector }       from '../connectors/zol-vebegadol'
import { ShefaBirkatHashemConnector }  from '../connectors/shefa-birkat-hashem'
import { MishnatYosefConnector }       from '../connectors/mishnat-yosef'
import { NetivHachesedConnector }      from '../connectors/netiv-hachesed'
import { YeshChesedConnector }         from '../connectors/yesh-chesed'
import { GoodPharmConnector }          from '../connectors/good-pharm'
import { PolitzerConnector }           from '../connectors/politzer'
import { BarKolConnector }             from '../connectors/bar-kol'
import { AmpmConnector }               from '../connectors/ampm'
import { SuperYudaConnector }          from '../connectors/super-yuda'
import { SuperCofixConnector }         from '../connectors/super-cofix'

const REGISTRY: RetailerConnector[] = [
  new ShufersalConnector(),
  new RamiLevyConnector(),
  new VictoryConnector(),
  new CarrefourConnector(),
  new OsherAdConnector(),
  new YohananofConnector(),
  new TivTaamConnector(),
  new YeinotBitanConnector(),
  new MahsaneiHashukConnector(),
  new HatziHinamConnector(),
  new KeshetTeamimConnector(),
  new FreshMarketConnector(),
  new StopMarketConnector(),
  new ShukHairConnector(),
  new SuperBareketConnector(),
  new KingStoreConnector(),
  new SalachDabachConnector(),
  new Maayan2000Connector(),
  new ZolVebegadolConnector(),
  new ShefaBirkatHashemConnector(),
  new MishnatYosefConnector(),
  new NetivHachesedConnector(),
  new YeshChesedConnector(),
  new GoodPharmConnector(),
  new PolitzerConnector(),
  new BarKolConnector(),
  new AmpmConnector(),
  new SuperYudaConnector(),
  new SuperCofixConnector(),
]

// ── Per-chain pipeline ────────────────────────────────────────────────────────
async function syncChain(
  adapter: RetailerConnector,
  supabase: SupabaseClient
): Promise<ChainSyncResult> {
  const t0     = Date.now()
  const errors: string[] = []
  let productsUpserted = 0
  let pricesUpserted   = 0
  let promosUpserted   = 0

  try {
    // 1. Ensure chain + default store exist
    const chainId = await ensureChain(supabase, adapter.chainSlug, adapter.chainName)
    const storeId = await ensureStore(supabase, chainId, 'default')

    // 2. Download
    const raw = await adapter.download()

    // 3. Parse
    const rawProducts = await adapter.parse(raw)

    // 4. Normalize
    const normalized = normalizeProducts(rawProducts)

    // 5. Upsert products
    const pResult = await upsertProducts(supabase, normalized)
    productsUpserted = pResult.upserted
    errors.push(...pResult.errors)

    // 6. Upsert prices
    const prResult = await upsertPrices(supabase, normalized, storeId)
    pricesUpserted = prResult.upserted
    errors.push(...prResult.errors)

    // 7. Optional: promotions
    if (adapter.downloadPromos && adapter.parsePromos) {
      try {
        const promoRaw   = await adapter.downloadPromos()
        const rawPromos  = await adapter.parsePromos!(promoRaw)
        const proResult  = await upsertPromotions(supabase, rawPromos, chainId)
        promosUpserted   = proResult.upserted
        errors.push(...proResult.errors)
      } catch (err) {
        errors.push(`promos: ${String(err)}`)
      }
    }
  } catch (err) {
    errors.push(String(err))
  }

  const status = errors.length === 0 ? 'success'
    : productsUpserted > 0           ? 'partial'
    : 'failed'

  return {
    chainSlug: adapter.chainSlug,
    chainName: adapter.chainName,
    status,
    productsUpserted,
    pricesUpserted,
    promosUpserted,
    errors,
    durationMs: Date.now() - t0,
  }
}

// ── Public entry point ────────────────────────────────────────────────────────
export async function runDailySync(supabase: SupabaseClient): Promise<SyncReport> {
  const startedAt = new Date().toISOString()

  // Download all retailers concurrently — failures don't block others
  const results = await Promise.allSettled(
    REGISTRY.map(adapter => syncChain(adapter, supabase))
  )

  const chains = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          chainSlug:        REGISTRY[i].chainSlug,
          chainName:        REGISTRY[i].chainName,
          status:           'failed' as const,
          productsUpserted: 0,
          pricesUpserted:   0,
          promosUpserted:   0,
          errors:           [(r as PromiseRejectedResult).reason?.message ?? 'Unknown error'],
          durationMs:       0,
        }
  )

  const report: SyncReport = {
    startedAt,
    finishedAt:    new Date().toISOString(),
    totalProducts: chains.reduce((s, c) => s + c.productsUpserted, 0),
    totalPrices:   chains.reduce((s, c) => s + c.pricesUpserted, 0),
    totalPromos:   chains.reduce((s, c) => s + c.promosUpserted, 0),
    chains,
    errors:        chains.flatMap(c => c.errors),
  }

  // Write sync log
  await supabase.from('sync_log').insert({
    started_at:        report.startedAt,
    finished_at:       report.finishedAt,
    status:            report.errors.length === 0 ? 'success' : 'partial',
    products_upserted: report.totalProducts,
    prices_upserted:   report.totalPrices,
    errors:            report.errors,
  })

  return report
}
