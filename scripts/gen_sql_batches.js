'use strict';
const fs   = require('fs');
const path = require('path');

const HARVEST = path.join(__dirname, '..', 'data', 'harvest_output.json');
const OUT_DIR = path.join(__dirname, '..', 'data');

const data = JSON.parse(fs.readFileSync(HARVEST, 'utf8'));

function esc(v) {
  if (v === null || v === undefined || String(v).trim() === '') return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const BATCH = 400;
let bn = 0;

// ── Product batches ──
for (let i = 0; i < data.products.length; i += BATCH) {
  const rows = data.products.slice(i, i + BATCH).map(p => {
    return `(${esc(p.name)},${esc(p.brand)},${esc(p.category)},${esc(p.barcode)},${esc(p.image_url)})`;
  }).join(',\n  ');

  const sql =
    `INSERT INTO public.products (name,brand,category,barcode,image_url) VALUES\n  ` +
    rows +
    `\nON CONFLICT (barcode) DO UPDATE SET\n` +
    `  name       = EXCLUDED.name,\n` +
    `  brand      = COALESCE(EXCLUDED.brand, products.brand),\n` +
    `  category   = EXCLUDED.category,\n` +
    `  image_url  = COALESCE(EXCLUDED.image_url, products.image_url);\n`;

  fs.writeFileSync(path.join(OUT_DIR, `batch_p_${bn}.sql`), sql, 'utf8');
  process.stdout.write(`p${bn} `);
  bn++;
}
console.log(`\nProduct batches: ${bn}`);

// ── Price batches ──
bn = 0;
for (let i = 0; i < data.prices.length; i += BATCH) {
  const rows = data.prices.slice(i, i + BATCH).map(p => {
    const idSub = p.key.includes('|||')
      ? `(SELECT id FROM public.products WHERE name=${esc(p.key.split('|||')[0])} LIMIT 1)`
      : `(SELECT id FROM public.products WHERE barcode=${esc(p.key)} LIMIT 1)`;
    return `(${idSub},${esc(p.market_name)},${p.price},NOW())`;
  }).join(',\n  ');

  const sql =
    `INSERT INTO public.market_prices (product_id,market_name,price,scraped_at) VALUES\n  ` +
    rows +
    `\nON CONFLICT (product_id,market_name)\n` +
    `DO UPDATE SET price=EXCLUDED.price, scraped_at=EXCLUDED.scraped_at;\n`;

  fs.writeFileSync(path.join(OUT_DIR, `batch_prices_${bn}.sql`), sql, 'utf8');
  process.stdout.write(`pr${bn} `);
  bn++;
}
console.log(`\nPrice batches: ${bn}`);
console.log('Done. SQL files in data/');
