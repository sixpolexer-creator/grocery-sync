'use strict';

const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const tls  = require('tls');
const { XMLParser } = require('fast-xml-parser');

// ─── Config ──────────────────────────────────────────────────────────────────

const TMP = path.join(os.tmpdir(), 'grocery_harvest');
// Output file — MCP execute_sql will seed from this JSON after the script runs
const OUTPUT_JSON = path.join(__dirname, '..', 'data', 'harvest_output.json');

// Sectigo intermediate cert AIA URL — publishedprices.co.il server omits it from the chain
const SECTIGO_INTERMEDIATE_URL = 'http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt';

const CHAINS = [
  { id: 'shufersal',   name: 'שופרסל',   type: 'shufersal',      storeId: '413' },
  { id: 'rami_levi',   name: 'רמי לוי',   type: 'publishedprices', user: 'RamiLevi',   pass: '' },
  { id: 'osher_ad',    name: 'אושר עד',   type: 'publishedprices', user: 'OsherAd',    pass: '' },
  { id: 'yohananof',   name: 'יוחננוף',   type: 'publishedprices', user: 'Yohananof',  pass: '' },
  { id: 'tiv_taam',    name: 'טיב טעם',   type: 'publishedprices', user: 'TivTaam',    pass: '' },
  { id: 'city_market', name: 'שוק העיר',  type: 'publishedprices', user: 'CityMarket', pass: '' },
];

const CATEGORY_RULES = [
  [/חלב|גבינ|יוגורט|קוטג|שמנת|ביצ|חמאה|לבן|בולגרי|קשקבל|ריקוטה|מוצרלה/, 'מוצרי חלב וביצים'],
  [/לחם|פיתה|בגט|חלה|לחמנ|עוגה|עוגיות|קרואסון|מאפה|בייגלה|קרקר|טוסט|בריוש/, 'לחם ומאפים'],
  [/טונה|שימור|סרדינ|קטשופ|רוטב|ממרח|מיונז|חרדל|קרם שמפ|פסטה רוטב/, 'שימורים ורטבים'],
  [/אורז|קמח|סוכר|עדשים|שקדים|פסטה |ספגטי|מקרוני|קינואה|כוסמת|גריסים|שיבולת/, 'יבשים וקטניות'],
  [/חטיף|במבה|ביסלי|שוקולד|סוכרי|גלידה|ופל|פופקורן|נשנוש|ארטיק|קנדי|גומי/, 'חטיפים ומתוקים'],
  [/מיץ|קפה|תה |מים |שתייה|קולה|נקטר|בירה |יין |ספרייט|פנטה|רד בול|נסקפה/, 'שתייה וקפה'],
  [/סבון|שמפו|ניקוי|כביסה|דאודורנט|קרם |נוזל ניקוי|ממיס|נייר טואלט|ממחטות|אלכוג|פלסטר/, 'ניקיון וטיפוח'],
];

function categorize(name = '') {
  for (const [pat, cat] of CATEGORY_RULES) {
    if (pat.test(name)) return cat;
  }
  return 'שונות';
}

// ─── Certificate fix ──────────────────────────────────────────────────────────
// publishedprices.co.il serves a valid Sectigo cert but omits the intermediate
// from the TLS handshake. We download it via AIA and inject it into our agent.

let ppAgent = null; // set in bootstrap()

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function bootstrap() {
  // publishedprices.co.il serves a valid Sectigo leaf cert but omits the intermediate
  // from the TLS handshake. Fix: merge Node's built-in root CAs with the missing intermediate.
  process.stdout.write('Fetching Sectigo intermediate cert for publishedprices.co.il... ');
  try {
    const der = await downloadBuffer(SECTIGO_INTERMEDIATE_URL);
    const b64 = der.toString('base64').match(/.{1,64}/g).join('\n');
    const intermediatePem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`;
    // tls.rootCertificates contains all of Node's built-in trusted root CAs
    // Appending the intermediate cert completes the chain: leaf→intermediate→root(trusted)
    const caBundle = [...tls.rootCertificates, intermediatePem].join('\n');
    ppAgent = new https.Agent({ ca: caBundle });
    console.log('✓');
  } catch (e) {
    console.warn(`⚠ Could not fetch intermediate cert (${e.message}), falling back to default trust store`);
    ppAgent = new https.Agent({});
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpRequest(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const maxRedirects = opts._redirects ?? 8;
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));

    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   opts.method || 'GET',
      agent:    opts.agent || undefined,
      headers:  { 'User-Agent': 'Mozilla/5.0 (il-price-harvest/1.0)', ...opts.headers },
    };

    const req = mod.request(reqOpts, res => {
      if ([301,302,303,307,308].includes(res.statusCode)) {
        const loc = new URL(res.headers.location, url).href;
        const newCookies = mergeCookies(opts.headers?.Cookie, extractSetCookies(res.headers));
        return resolve(httpRequest(loc, { ...opts, _redirects: maxRedirects - 1,
          headers: { ...opts.headers, Cookie: newCookies } }));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function extractSetCookies(headers) {
  const raw = headers['set-cookie'] || [];
  return (Array.isArray(raw) ? raw : [raw]).map(c => c.split(';')[0]).join('; ');
}

function mergeCookies(...parts) {
  return parts.filter(Boolean).join('; ');
}

function streamFile(url, dest, agent, cookies = '', maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      agent,
      headers:  {
        'User-Agent': 'Mozilla/5.0 (il-price-harvest/1.0)',
        ...(cookies ? { Cookie: cookies } : {}),
      },
    };
    mod.get(opts, res => {
      if ([301,302,303,307,308].includes(res.statusCode)) {
        return resolve(streamFile(new URL(res.headers.location, url).href, dest, agent, cookies, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

function gunzip(src) {
  const dest = src.replace(/\.gz$/i, '');
  return new Promise((resolve, reject) => {
    fs.createReadStream(src)
      .pipe(zlib.createGunzip())
      .pipe(fs.createWriteStream(dest))
      .on('finish', () => resolve(dest))
      .on('error', reject);
  });
}

// ─── Shufersal (public HTML portal) ──────────────────────────────────────────

async function getShufersalDownload(storeId) {
  // catID=2 = PriceFull; request store directly to keep result set small
  const ts = Date.now();
  const url = `https://prices.shufersal.co.il/FileObject/UpdateCategory` +
    `?catID=2&storeId=${storeId}&sortColumn=FileCreationDate&sortOrder=DESC&page=1&__swhg=${ts}`;

  const { body } = await httpRequest(url, { headers: { Accept: 'text/html,*/*' } });

  // Extract <a href="https://...gz..."> links (HTML-entity-decoded)
  const re = /href="(https?:\/\/[^"]+\.gz[^"]*)"/gi;
  const urls = [];
  for (const m of body.matchAll(re)) {
    urls.push(m[1].replace(/&amp;/g, '&'));
  }

  if (!urls.length) throw new Error(`No .gz links found on Shufersal portal for store ${storeId}`);

  // Prefer the most recently named file (filename contains date+time)
  const sorted = urls.sort((a, b) => b.localeCompare(a));
  const dlUrl = sorted[0];
  const filename = dlUrl.split('?')[0].split('/').pop();
  console.log(`  ✓ ${filename}`);
  return dlUrl;
}

// ─── publishedprices.co.il portal ────────────────────────────────────────────

async function getPublishedPricesDownload(user, pass) {
  const BASE = 'https://url.retail.publishedprices.co.il';
  const agent = ppAgent;

  // Get login page
  const loginPage = await httpRequest(`${BASE}/login`, { agent, headers: { Accept: 'text/html' } });
  const preCookies = extractSetCookies(loginPage.headers);
  const csrfM = loginPage.body.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
  const csrf = csrfM ? csrfM[1] : '';

  // POST login
  const form = [`user=${encodeURIComponent(user)}`, `password=${encodeURIComponent(pass)}`];
  if (csrf) form.push(`_token=${encodeURIComponent(csrf)}`);
  const formBody = form.join('&');

  const loginRes = await httpRequest(`${BASE}/login`, {
    method: 'POST',
    agent,
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody),
      Cookie:           preCookies,
      Referer:          `${BASE}/login`,
    },
    body: formBody,
  });

  const sessionCookies = mergeCookies(preCookies, extractSetCookies(loginRes.headers));
  if (!sessionCookies) console.warn(`  ⚠ No session cookie for ${user}`);

  // List files
  const listRes = await httpRequest(`${BASE}/file/`, {
    agent,
    headers: { Cookie: sessionCookies, Accept: 'application/json,text/html,*/*' },
  });

  let files = [];
  try {
    const json = JSON.parse(listRes.body);
    files = json.d || json.data || json.files || (Array.isArray(json) ? json : []);
  } catch {
    // HTML fallback — extract hrefs ending in .gz
    for (const m of listRes.body.matchAll(/href=["']([^"']*\.gz)["']/gi)) {
      files.push({ name: m[1].split('/').pop(), href: m[1] });
    }
  }

  const pfFiles = files
    .filter(f => /pricefull/i.test(f.name || f.key || f.href || ''))
    .sort((a, b) => (b.name || b.key || '').localeCompare(a.name || a.key || ''));

  if (!pfFiles.length) throw new Error(`No PriceFull files found for ${user}`);

  const best = pfFiles[0];
  const fileName = best.name || best.key || (best.href || '').split('/').pop();
  console.log(`  ✓ ${fileName}`);
  return { url: `${BASE}/file/d/${fileName}`, cookies: sessionCookies };
}

// ─── XML parsing ─────────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes:    false,
  parseTagValue:       true,
  trimValues:          true,
  parseAttributeValue: true,
});

function parseItems(xmlPath) {
  const raw = fs.readFileSync(xmlPath, 'utf8');
  const doc = parser.parse(raw);
  const root = doc.root || doc.Root || doc.Prices || doc.PriceFile || doc.Catalog
             || Object.values(doc).find(v => v && typeof v === 'object');
  if (!root) return [];
  const itemsNode = root.Items || root.Products || root.items || root.Rows;
  if (!itemsNode) return [];
  const raw2 = itemsNode.Item || itemsNode.Product || itemsNode.Row || itemsNode.item;
  if (!raw2) return [];
  return Array.isArray(raw2) ? raw2 : [raw2];
}

function normalize(rawItems, chain) {
  const out = [];
  for (const item of rawItems) {
    const name   = String(item.ItemName || item.ProductName || item.Name || '').trim();
    const brand  = String(item.ManufactureName || item.ManufactureDesc || item.Brand || '').trim();
    const price  = parseFloat(String(item.ItemPrice ?? item.UnitPrice ?? item.Price ?? 0).replace(',', '.'));
    const code   = String(item.ItemCode || item.Barcode || item.ItemId || '').trim();
    const imgRaw = String(item.ItemImage || item.ImageUrl || item.Image || '').trim();

    if (!name || isNaN(price) || price <= 0 || price > 2000) continue;

    const barcode = /^\d{7,14}$/.test(code) ? code : null;
    let imageUrl = imgRaw || null;
    if (!imageUrl && chain.id === 'shufersal' && barcode && barcode.length >= 12) {
      imageUrl = `https://d226b0iufwcjmj.cloudfront.net/v2/ean/${barcode}.jpg`;
    }

    out.push({
      name,
      brand:     brand || null,
      barcode,
      category:  categorize(name),
      imageUrl,
      price,
      chainName: chain.name,
      key:       barcode || `${name}|||${brand || ''}`,
    });
  }
  return out;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function upsertBatch(supabase, table, rows, onConflict) {
  const BATCH = 400;
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) console.warn(`  ⚠ ${table} batch [${i}]: ${error.message}`);
    else n += Math.min(BATCH, rows.length - i);
  }
  return n;
}

// ─── Per-chain pipeline ───────────────────────────────────────────────────────

async function processChain(chain) {
  console.log(`\n▶ ${chain.name} (${chain.id})`);
  fs.mkdirSync(TMP, { recursive: true });

  let dlUrl, cookies = '', agent;

  try {
    if (chain.type === 'shufersal') {
      dlUrl = await getShufersalDownload(chain.storeId);
      agent = undefined; // uses --use-system-ca for Azure Blob
    } else {
      const r = await getPublishedPricesDownload(chain.user, chain.pass);
      dlUrl = r.url; cookies = r.cookies; agent = ppAgent;
    }
  } catch (e) {
    console.error(`  ✗ URL lookup: ${e.message}`); return null;
  }

  const gzPath  = path.join(TMP, `${chain.id}.xml.gz`);
  const xmlPath = path.join(TMP, `${chain.id}.xml`);

  try {
    process.stdout.write('  Downloading... ');
    await streamFile(dlUrl, gzPath, agent, cookies);
    const gzMb = (fs.statSync(gzPath).size / 1048576).toFixed(1);
    process.stdout.write(`${gzMb} MB gz → `);
    await gunzip(gzPath);
    const xmlMb = (fs.statSync(xmlPath).size / 1048576).toFixed(1);
    console.log(`${xmlMb} MB xml`);
  } catch (e) {
    console.error(`\n  ✗ Download/decompress: ${e.message}`); return null;
  }

  try {
    const raw   = parseItems(xmlPath);
    const items = normalize(raw, chain);
    console.log(`  Parsed: ${raw.length.toLocaleString()} raw → ${items.length.toLocaleString()} valid`);
    return items;
  } catch (e) {
    console.error(`  ✗ Parse: ${e.message}`); return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await bootstrap();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Israeli Supermarket Price Harvest (חוק המזון)');
  console.log(`  Chains: ${CHAINS.map(c => c.name).join(' · ')}`);
  console.log('══════════════════════════════════════════════════════');

  const productMap = new Map(); // dedup key → product row
  const priceQueue = [];        // { key, chainName, price }
  const stats = {};

  for (const chain of CHAINS) {
    const items = await processChain(chain);
    stats[chain.id] = items ? items.length : 0;
    if (!items) continue;

    for (const item of items) {
      if (!productMap.has(item.key)) {
        productMap.set(item.key, {
          name: item.name, brand: item.brand, barcode: item.barcode,
          category: item.category, image_url: item.imageUrl,
        });
      } else if (item.imageUrl && !productMap.get(item.key).image_url) {
        productMap.get(item.key).image_url = item.imageUrl;
      }
      priceQueue.push({ key: item.key, chainName: item.chainName, price: item.price });
    }
  }

  // ── Write output JSON for MCP seeding ──
  const outputDir = path.dirname(OUTPUT_JSON);
  fs.mkdirSync(outputDir, { recursive: true });

  const productsArr = [...productMap.values()];
  const output = {
    harvested_at: new Date().toISOString(),
    stats,
    products: productsArr,
    // prices keyed by product barcode/name for MCP-side join
    prices: priceQueue.map(p => ({ key: p.key, market_name: p.chainName, price: p.price })),
  };
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf8');

  const sizeMb = (fs.statSync(OUTPUT_JSON).size / 1048576).toFixed(2);
  console.log(`\n✓ Wrote ${OUTPUT_JSON}`);
  console.log(`  ${productsArr.length.toLocaleString()} products · ${priceQueue.length.toLocaleString()} price entries · ${sizeMb} MB`);

  // ── Summary ──
  console.log('\n══════════════════ SUMMARY ══════════════════════');
  for (const c of CHAINS) {
    const v = stats[c.id] ?? 0;
    console.log(`  ${c.name.padEnd(14)}: ${String(v).padStart(7)} items  ${v === 0 ? '✗' : '✓'}`);
  }
  console.log(`  ${'TOTAL'.padEnd(14)}: ${String(productsArr.length).padStart(7)} unique products`);
  console.log(`  ${''.padEnd(14)}  ${String(priceQueue.length).padStart(7)} price records`);
  console.log('\n📋 Next: run seed_from_json.js (or use MCP execute_sql) to write to Supabase.\n');
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1); });
