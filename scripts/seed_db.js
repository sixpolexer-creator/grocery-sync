'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://guvzhlbbhwcdnobqlvot.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnpobGJiaHdjZG5vYnFsdm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MTg2MTEsImV4cCI6MjA5ODE5NDYxMX0.HHUwRuNYIcWgIINPy2jOXBL4gB-rsrboHEEBBSK0foU';
const HARVEST      = path.join(__dirname, '..', 'data', 'harvest_output.json');
const BATCH        = 500;

function rpc(fn, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ data: payload });
    const url  = new URL(`${SUPABASE_URL}/rest/v1/rpc/${fn}`);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey':         ANON_KEY,
        'Authorization':  `Bearer ${ANON_KEY}`,
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        else resolve(JSON.parse(raw));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const { products, prices } = JSON.parse(fs.readFileSync(HARVEST, 'utf8'));

  // ── Products ──────────────────────────────────────────────────────
  console.log(`\nSeeding ${products.length} products in batches of ${BATCH}…`);
  let totalP = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH).map(p => ({
      name:      p.name,
      brand:     p.brand || null,
      category:  p.category,
      barcode:   p.barcode,
      image_url: p.image_url || null,
    }));
    const n = await rpc('seed_products', batch);
    totalP += n;
    process.stdout.write(`  p${Math.floor(i/BATCH)} (${n} rows) `);
  }
  console.log(`\nProducts done: ${totalP} upserted`);

  // ── Prices ────────────────────────────────────────────────────────
  console.log(`\nSeeding ${prices.length} prices in batches of ${BATCH}…`);
  let totalPr = 0;
  for (let i = 0; i < prices.length; i += BATCH) {
    const batch = prices.slice(i, i + BATCH).map(p => ({
      barcode:     p.key.includes('|||') ? null : p.key,
      market_name: p.market_name,
      price:       p.price,
    })).filter(p => p.barcode);   // skip name-keyed entries (no barcode)
    if (batch.length === 0) { process.stdout.write(`  pr${Math.floor(i/BATCH)}(skip) `); continue; }
    const n = await rpc('seed_prices', batch);
    totalPr += n;
    process.stdout.write(`  pr${Math.floor(i/BATCH)} (${n} rows) `);
  }
  console.log(`\nPrices done: ${totalPr} upserted`);

  console.log('\n✓ Seed complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
