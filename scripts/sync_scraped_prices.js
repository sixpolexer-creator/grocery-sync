'use strict';
/**
 * Parses the raw government price-feed XML files dropped by
 * `python scraper/run_scrape.py` (under scraper/dumps/<ScraperName>/...) and
 * upserts them into the *live* tables the app actually reads:
 * public.products (on conflict barcode) and public.market_prices
 * (on conflict product_id, market_name) — see CLAUDE.md's "two disconnected
 * pricing systems" note for why it's these tables and not
 * chains/stores/prices.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (RLS-bypassing writes).
 * Uses plain .upsert() calls, not the undocumented seed_products/seed_prices
 * RPCs scripts/seed_db.js relies on — those RPCs' definitions aren't tracked
 * anywhere in this repo, so this script doesn't depend on them.
 */
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { createClient } = require('@supabase/supabase-js');

const DUMPS_DIR = path.join(__dirname, '..', 'scraper', 'dumps');
const BATCH = 500;

const CHAIN_NAME_MAP = require('../scraper/chain-name-map.json');

// Keyed by the actual scraper/dumps/<X> folder name (il_supermarket_scarper's
// DumpFolderNames value, e.g. "RamiLevy") — NOT the ScraperFactory enum name
// ("RAMI_LEVY"). Confirmed against a real run; see chain-name-map.json's comment.
function marketNameFor(scraperFolderName) {
  return CHAIN_NAME_MAP[scraperFolderName] || scraperFolderName;
}

// ── XML parsing (mirrors src/pricing-engine/utils/xml-stream.ts + parsers/xml-price.ts) ──

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: name => ['Item', 'Product', 'Row', 'PriceElement'].includes(name),
});

function findFirstArray(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return null;
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val;
    const nested = findFirstArray(val, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function xmlStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function xmlNum(val) {
  const n = parseFloat(String(val ?? ''));
  return Number.isNaN(n) ? 0 : n;
}

function parseGovPriceXml(raw) {
  const doc = xmlParser.parse(raw);
  const items = findFirstArray(doc) ?? [];
  const results = [];

  for (const item of items) {
    const barcode = xmlStr(item.ItemCode ?? item.Barcode ?? item.PLU);
    const name = xmlStr(item.ItemName ?? item.ProductName ?? item.Name);
    if (!name) continue;

    const price = xmlNum(item.ItemPrice ?? item.Price ?? item.UnitPrice);
    if (price <= 0) continue;

    results.push({
      barcode: barcode || null,
      name,
      // Field name varies by chain: some feeds use "ManufacturerName", others
      // (e.g. Rami Levy, confirmed against a real dump) misspell it as
      // "ManufactureName". Check both.
      brand: xmlStr(item.ManufacturerName ?? item.ManufactureName ?? item.Manufacturer) || null,
      category: xmlStr(item.ItemSection ?? item.Category) || null,
      price,
    });
  }
  return results;
}

// ── Walk scraper/dumps/<ScraperName>/**/*.xml ────────────────────────────────

function findXmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findXmlFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) out.push(full);
  }
  return out;
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  if (!fs.existsSync(DUMPS_DIR)) {
    console.log(`No dumps found at ${DUMPS_DIR} — nothing to sync.`);
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const scraperDirs = fs.readdirSync(DUMPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'status');

  let totalProducts = 0;
  let totalPrices = 0;
  const errors = [];

  for (const scraperDir of scraperDirs) {
    const marketName = marketNameFor(scraperDir.name);
    const xmlFiles = findXmlFiles(path.join(DUMPS_DIR, scraperDir.name))
      .filter(f => /price/i.test(path.basename(f)) && !/promo/i.test(path.basename(f)));

    if (xmlFiles.length === 0) continue;

    // De-dupe by barcode within this chain — feeds can list the same item
    // across multiple store files; keep the lowest price seen.
    const byBarcode = new Map();
    for (const file of xmlFiles) {
      let rows;
      try {
        rows = parseGovPriceXml(fs.readFileSync(file, 'utf-8'));
      } catch (err) {
        errors.push(`${scraperDir.name}/${path.basename(file)}: ${err.message}`);
        continue;
      }
      for (const row of rows) {
        if (!row.barcode) continue; // market_prices upsert is barcode-keyed via products
        const existing = byBarcode.get(row.barcode);
        if (!existing || row.price < existing.price) byBarcode.set(row.barcode, row);
      }
    }

    const rows = [...byBarcode.values()];
    if (rows.length === 0) continue;

    console.log(`${scraperDir.name} (${marketName}): ${rows.length} products across ${xmlFiles.length} files`);

    // 1. Upsert products, keyed by barcode
    for (const batch of chunks(rows, BATCH)) {
      const { error } = await supabase
        .from('products')
        .upsert(
          batch.map(r => ({ barcode: r.barcode, name: r.name, brand: r.brand, category: r.category })),
          { onConflict: 'barcode' }
        );
      if (error) { errors.push(`${scraperDir.name} products upsert: ${error.message}`); continue; }
      totalProducts += batch.length;
    }

    // 2. Look up product ids for this chain's barcodes
    const idByBarcode = new Map();
    for (const batch of chunks(rows.map(r => r.barcode), BATCH)) {
      const { data, error } = await supabase.from('products').select('id, barcode').in('barcode', batch);
      if (error) { errors.push(`${scraperDir.name} product lookup: ${error.message}`); continue; }
      for (const p of data ?? []) idByBarcode.set(p.barcode, p.id);
    }

    // 3. Upsert market_prices, keyed by (product_id, market_name)
    const priceRows = rows
      .map(r => ({ product_id: idByBarcode.get(r.barcode), market_name: marketName, price: r.price, scraped_at: new Date().toISOString() }))
      .filter(r => r.product_id);

    for (const batch of chunks(priceRows, BATCH)) {
      const { error } = await supabase
        .from('market_prices')
        .upsert(batch, { onConflict: 'product_id,market_name' });
      if (error) { errors.push(`${scraperDir.name} market_prices upsert: ${error.message}`); continue; }
      totalPrices += batch.length;
    }
  }

  console.log(`\nDone. Products upserted: ${totalProducts}, prices upserted: ${totalPrices}.`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    errors.forEach(e => console.error(' -', e));
    process.exitCode = 1;
  }
}

main().catch(err => { console.error(err); process.exit(1); });
