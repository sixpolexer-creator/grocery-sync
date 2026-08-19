# Price scraper

Downloads Israeli supermarket price feeds and syncs them into Supabase's
`market_prices` table (the one `src/app/api/shopping/compare/route.ts` and
`ListDetailClient.tsx` actually read — see the root `CLAUDE.md` for the
"two disconnected pricing systems" note on why it's this table and not the
`chains`/`stores`/`prices` schema in `supabase/schema.sql`).

Two separate steps, two runtimes:

1. **Download** (Python) — `run_scrape.py` wraps
   [`il_supermarket_scarper`](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers),
   a third-party scraper covering ~30 Israeli chains' government-mandated
   price-transparency feeds. Writes raw XML to `scraper/dumps/<ChainName>/`.
2. **Parse + upsert** (Node) — `../scripts/sync_scraped_prices.js` reads those
   XML files, parses the standard gov price-feed schema, and upserts into
   `products` (by barcode) and `market_prices` (by product_id + market_name)
   via plain Supabase `.upsert()` calls using the service-role key.

Both run in sequence in `.github/workflows/scrape-prices.yml` on a daily
cron, and can be triggered manually from the Actions tab
(`workflow_dispatch`, with optional `enabled_scrapers`/`limit` inputs for a
quick test run).

## Running locally

```bash
python -m venv scraper/.venv
scraper/.venv/Scripts/activate   # or source scraper/.venv/bin/activate on macOS/Linux
pip install -r scraper/requirements.txt

# Optional: restrict to a couple of chains and cap file count for a fast test
ENABLED_SCRAPERS=SHUFERSAL,RAMI_LEVY LIMIT=5 python scraper/run_scrape.py

SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync_scraped_prices.js
```

## Attribution & license

`il_supermarket_scarper` is used under its
[custom non-commercial license](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers/blob/main/LICENSE.txt):
free to use, modify, and distribute for non-commercial purposes with
attribution; commercial use requires the author's written permission
(contact: erlichsefi@gmail.com). **If grocery-sync ever becomes a commercial
product, get that permission (or replace this scraper) before shipping.**

This integration modifies nothing in the upstream package — `run_scrape.py`
only configures and calls its public `ScarpingTask` API — but per the
license's attribution requirement: credit to Sefi Erlich / the
[israeli-supermarket-scarpers](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers)
project for the scraping logic itself.

## Chain naming

`chain-name-map.json` maps the scraper's `ScraperFactory` names to the
Hebrew `market_name` strings already used in `market_prices` and in the
`CHAIN_STORES` geolocation table in `compare/route.ts`. A chain missing from
`CHAIN_STORES` still gets its prices synced — it just won't be included in
distance-filtered results until a branch location is added there. Update
this map by hand if upstream adds/renames a chain
(`il_supermarket_scarper/scrappers_factory.py`).

## Known gaps (not addressed by this scaffold)

- No dedup/matching against products already seeded by
  `scripts/harvest_catalogs.js` beyond the shared `barcode` unique
  constraint — barcode collisions merge correctly, but products without a
  barcode aren't deduped (the same gap the existing harvest scripts have).
- No retry/backoff around the Supabase upsert calls — a transient failure
  mid-run fails that chain's batch and moves on (errors are collected and
  reported, not retried).
- `run_scrape.py` uses `single_pass=True` so it fits a CI job; if the
  upstream package's per-chain login/session flows are meaningfully slower
  than a GitHub Actions job's time budget for the full ~30-chain set, split
  `ENABLED_SCRAPERS` across multiple scheduled/matrix jobs rather than
  raising the timeout indefinitely.
