@AGENTS.md

# grocery-sync — Project Memory

Audited 2026-08-19. Shared grocery-list app (Hebrew/RTL, Israel-focused) with a
price-comparison feature layered on top. Next.js 16 App Router + Supabase.

## Tech stack

- **Next.js 16.2.9** (App Router), **React 19.2.4**, **TypeScript 5** (strict)
- **Supabase**: Postgres + Auth (cookie sessions via `@supabase/ssr`) + Realtime + Storage
- **Tailwind CSS 4**, `lucide-react` icons, `clsx`/`tailwind-merge`
- **fast-xml-parser** for government price-feed XML parsing
- Deployed on **Vercel** (`vercel.json` is `{}` — all defaults; `@vercel/analytics` wired
  into root layout; Vercel Cron hits `/api/pricing/sync`)
- No test framework of any kind is installed (no Jest/Vitest/Playwright, no `*.test.*`
  files exist anywhere in `src/`).

## Entry points & routing

- `src/proxy.ts` — Next 16 renamed `middleware.ts` → `proxy.ts` (see commit `65f757c`).
  Runs `updateSession` (`src/lib/supabase/middleware.ts`): refreshes the Supabase session,
  redirects unauthenticated users to `/login`, redirects authenticated users with no
  `username` set to `/onboarding`.
- `src/app/(app)/` — authenticated shell: `page.tsx` (dashboard), `lists/`, `lists/[id]/`,
  `history/`.
- `src/app/login`, `src/app/onboarding`, `src/app/auth/callback` — auth flow.
- API routes: `src/app/api/pricing/sync/route.ts` (cron/manual retailer sync),
  `src/app/api/shopping/compare/route.ts` (price-comparison / basket-split endpoint used
  by `FindMeModal`).

## ⚠️ Known architectural issue: two disconnected pricing systems

This is the single biggest thing to understand before touching pricing code.

**System A — live, actually used by the app:**
`market_prices(product_id, market_name text, price)`, a flat table populated by one-off
scripts (`scripts/harvest_catalogs.js` → `scripts/gen_sql_batches.js` /
`scripts/seed_db.js`, via `seed_products`/`seed_prices` RPCs). This is what
`src/app/api/shopping/compare/route.ts` and `src/components/lists/ListDetailClient.tsx`
query. `market_name` is a free-text Hebrew chain name (e.g. `'שופרסל'`), matched against a
**hardcoded** `CHAIN_STORES` lat/lon table inside `compare/route.ts` for geolocation
filtering.

**System B — fully built, never read by the app:**
`src/pricing-engine/` — 25 retailer connectors (`connectors/*.ts`, one per Israeli chain),
a scheduler (`scheduler/index.ts`, registers all 25, runs them concurrently via
`Promise.allSettled`), normalizers, XML parsers, and an upsert layer
(`database/upsert.ts`). This writes to a *relational* schema — `chains` / `stores` /
`products.barcode` / `prices(product_id, store_id, price)` / `promotions` / `sync_log` —
as defined in `supabase/schema.sql`. It's wired up and reachable via
`POST/GET /api/pricing/sync` (Vercel Cron + manual secret), and looks production-ready.
**But nothing in the UI or API ever reads from `prices`/`chains`/`stores`.** The cron job
likely runs and silently writes to tables no feature consumes.

Also dead/stub in the same vein:
- `src/shopping-engine/basket/index.ts` and `recommendations/index.ts` — placeholder
  comments only (`// Phase 6: basket pricing aggregation`, `// Phase 7: personalized
  recommendations`), no implementation.
- `src/location-engine/distance/index.ts` — stub comment only.
- `src/location-engine/nearby-stores/index.ts` — a real, working haversine +
  nearest-store-per-chain implementation, but **not imported anywhere**. Meanwhile
  `compare/route.ts` reimplements haversine + nearest-store lookup inline against its own
  hardcoded `CHAIN_STORES` map. Three separate haversine implementations exist in the repo
  for what should be one.

**Before resuming pricing/store-location work, decide:** finish wiring System B in
(migrate `compare/route.ts` + `ListDetailClient.tsx` to read `prices`/`stores`/`chains`,
delete `market_prices` and the harvest scripts) **or** delete System B entirely (drop
`pricing-engine/`, `shopping-engine/basket`, `shopping-engine/recommendations`,
`location-engine/`, the `/api/pricing/sync` route, and the `chains`/`stores`/`prices`
tables from `schema.sql`) and keep the harvest-script + `market_prices` flow as the one
real system. Don't add new features to System B assuming it's live — it isn't.

**2026-08-19 update:** System A (`market_prices`) now has an automated, multi-chain feed —
see "Automated price scraping" below. This strengthens the case for deleting System B
rather than finishing it, since System A now covers ~30 chains on a daily cron instead of
one manually-run harvest script.

## Automated price scraping

`scraper/` (Python) + `scripts/sync_scraped_prices.js` (Node) — a two-step pipeline that
feeds System A (`market_prices`), scheduled daily via
`.github/workflows/scrape-prices.yml`:

1. `scraper/run_scrape.py` wraps the third-party
   [`il_supermarket_scarper`](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers)
   package (~30 Israeli chains' government price feeds) and dumps raw XML to
   `scraper/dumps/<ChainName>/`.
2. `scripts/sync_scraped_prices.js` parses that XML (same gov schema
   `src/pricing-engine/parsers/xml-price.ts` already knows — field names duplicated here
   in plain JS rather than shared, since that parser lives in TS and this runs as a
   standalone Node script) and upserts into `products` (by barcode) and `market_prices`
   (by `product_id, market_name`) via plain `.upsert()` calls — **not** the
   `seed_products`/`seed_prices` RPCs `scripts/seed_db.js` uses, since those RPCs' SQL
   isn't tracked anywhere in this repo.

**License note:** `il_supermarket_scarper` is non-commercial-use-only (custom license,
commercial use needs the author's written permission — see `scraper/README.md`). Confirmed
fine for this project's current non-commercial status as of 2026-08-19; revisit before any
commercial launch.

Chain-name mapping (ScraperFactory name → Hebrew `market_name`) lives in
`scraper/chain-name-map.json`, shared by both the Python and Node sides. Update it by hand
if the upstream package adds/renames a chain. A chain missing from `CHAIN_STORES` in
`compare/route.ts` still gets synced — it's just excluded from geolocation-filtered
results until a branch location is added there.

Once this pipeline has run reliably for a while, `scripts/harvest_catalogs.js`
(Shufersal-only, manual) becomes redundant and can be retired.

## Database / schema drift

`supabase/schema.sql` is **stale and does not match production**. It was written as a
"Production Schema v2" but the live DB (project `israeli-grocery`,
`guvzhlbbhwcdnobqlvot`) has since diverged via migrations applied directly through the
Supabase MCP tool rather than by running `schema.sql`:

- Live DB has `market_prices`, not the `prices`/`stores`/`chains` model `schema.sql`
  describes (see above).
- Live DB has `shopping_trips` + `shopping_trip_items` (added by
  `supabase/migration_shopping_trips.sql`, which replaced `purchase_history` —
  `schema.sql` still shows the old `purchase_history` table).
- Live DB also has a `shopping_trip_participants` table — referenced by
  `supabase/migration_fix_shopping_trips_rls_recursion.sql` (via
  `private.is_trip_participant`) — but **its `CREATE TABLE` is not present anywhere in
  version control**. Recover its definition from a live `pg_dump` / Supabase dashboard and
  add it to a migration file before anyone relies on `supabase/` as the source of truth.
- RLS policy names in `schema.sql` (`"View member lists"`, `"Public profile read"`, …)
  don't match the names actually altered in `migration_perf_security_audit.sql`
  (`"lists_select"`, `"Users can view all profiles"`, …) — the live policies were renamed
  at some point outside of what's tracked here.

Treat `supabase/*.sql` as **historical record of individual fixes**, not a restorable
source of truth. If you need the real current schema, pull it from Supabase directly
(dashboard or `supabase db dump`) rather than trusting `schema.sql`.

Security-relevant migrations worth knowing about (already applied, good hygiene, just
not reflected in `schema.sql`):
- `migration_lock_down_is_list_member_rpc.sql` — fixed an IDOR: `is_list_member()` was
  callable by anonymous users via auto-exposed PostgREST RPC, leaking list membership.
  Moved to a `private` schema.
- `migration_perf_security_audit.sql` — also fixed a **real unflagged leak**: the
  `profiles` SELECT policy had `qual = true`, letting the anon key dump every user's
  email with no auth.
- `migration_fix_shopping_trips_rls_recursion.sql` — broke an RLS infinite-recursion
  deadlock between `shopping_trips` and `shopping_trip_participants` policies.

## Environment variables

No `.env.example` exists (gap — should add one). Required vars, from grepping
`process.env.*`:

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client, server, middleware, API routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client, server, middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/pricing/sync` (service-role sync client) |
| `CRON_SECRET` | `/api/pricing/sync` GET (Vercel Cron auth) |
| `SYNC_SECRET` | `/api/pricing/sync` POST (manual trigger auth) |
| `SUPABASE_URL` (or reuses `NEXT_PUBLIC_SUPABASE_URL`) | `scripts/sync_scraped_prices.js`, set as a **GitHub Actions secret**, not a Vercel env var |
| `SUPABASE_SERVICE_ROLE_KEY` | same, GitHub Actions secret for `.github/workflows/scrape-prices.yml` |

`scripts/seed_db.js` hardcodes the Supabase project URL and **anon** key directly in the
committed source (not the service-role key — anon key is meant to be public — but it
still hardcodes a specific project ref rather than reading `.env`, which is bad practice
and worth cleaning up).

## Commands

```
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint .
npx tsc --noEmit # type-check (no dedicated script in package.json)
```

No test command exists.

## Health check results (2026-08-19)

- `npx tsc --noEmit` → **clean**, no errors.
- `npx eslint .` → **26 errors, 2 warnings**. Breakdown:
  - React Compiler purity-rule violations (`react-hooks/set-state-in-effect`,
    `react-hooks/purity`, `react-hooks/immutability`) in `useDeviceType.ts`,
    `ProductSearch.tsx`, `FindMeModal.tsx`, `HistoryClient.tsx` (impure `Date.now()` in a
    render path), `ThemeProvider.tsx`, `FriendsPanel.tsx` (`loadFriends` used in a
    `useEffect` before its `const` declaration — a real temporal-dead-zone bug, not just
    a lint nit).
  - `@typescript-eslint/no-explicit-any` in `ListDetailClient.tsx`,
    `lists/page.tsx`, `lists/[id]/page.tsx`.
  - `@typescript-eslint/no-require-imports` in all three `scripts/*.js` files (CommonJS
    `require()` — expected for standalone Node scripts, but eslint isn't scoped to
    exclude `scripts/` so it flags them; either add an override or leave as known noise).
- `npm audit --omit=dev` → **5 high-severity** advisories: `next` (9.3.4-canary –
  16.3.0-preview range, patched in 16.3.1), `postcss` (nested under `next`), `sharp`
  (libvips CVEs), `fast-xml-parser` (5.9.3–5.10.0), `nanoid` (≤3.3.17). No `npm audit fix
  --force` has been run — doing so bumps `next` above the pinned `16.2.9`, so test the
  App Router / Vercel Cron behavior after upgrading rather than blind-applying.
- No test suite exists to run.

## Git / repo state

- Remote: `origin` → `https://github.com/sixpolexer-creator/grocery-sync.git`, `master`
  up to date with `origin/master`.
- Working tree is clean except line-ending noise (CRLF vs LF) in `AGENTS.md`, `CLAUDE.md`,
  `README.md`, and untracked tooling directories (`.claude-flow/`, `.context/`,
  `.claude/proven-config.json`) that are ruflo/Claude Code harness artifacts, not project
  content — safe to leave untracked or gitignore, not a project concern.
- 11 stale remote worktree branches (`worktree-*`, one `ecc-tools/*`) from prior
  agent-driven work sessions, all already merged into `master` per the commit history —
  candidates for deletion but not urgent.
- Commit history is clean and descriptive (`feat:`, `fix:`, `perf:`, `security:`
  prefixes used consistently). Several PRs merged from worktree branches.
- `README.md` and `.claude/skills/grocery-sync/SKILL.md` /
  `.agents/skills/grocery-sync/SKILL.md` are boilerplate/auto-generated and **don't
  reflect real project conventions** — e.g. the SKILL.md claims PascalCase filenames and
  `@models/X`-style aliasing, but the actual codebase uses kebab-case directories
  (`pricing-engine/`, `shopping-engine/`) and a single `@/*` → `src/*` alias. Don't trust
  those files for conventions; this CLAUDE.md is the source of truth going forward.

## Data model (app-facing, matches `src/types/database.ts` + live `market_prices`)

`profiles` (1:1 with `auth.users`) → `lists` (owned) → `list_members` (join, roles
`owner`/`member`) → `items` (list_id, optional `product_id` link) → `products` /
`market_prices` (price comparison) . `friendships` (pending/accepted) and `presence`
(online/offline) are separate. `shopping_trips`/`shopping_trip_items` replaced
`purchase_history` (see schema-drift section — `src/types/database.ts` still types the
old `purchase_history` shape and does not include `shopping_trips`; regenerate types from
the live DB before relying on them for that feature).

Realtime is enabled on `items`, `list_members`, `presence`, `lists` — `ListDetailClient.tsx`
subscribes to `postgres_changes` for live list updates.

## Conventions actually observed in the code

- Path alias: `@/*` → `src/*` (see `tsconfig.json`).
- Feature-oriented top-level dirs under `src/`: `pricing-engine/`, `shopping-engine/`,
  `location-engine/`, plus standard Next.js `app/`, `components/`, `lib/`, `hooks/`,
  `types/`.
- kebab-case for directories and non-component files; PascalCase for React component
  files.
- Named exports throughout; no default exports observed outside Next.js page/layout
  convention files.
- RTL/Hebrew UI strings are inlined directly in components and API responses (not a
  separate i18n layer) — e.g. `compare/route.ts` returns Hebrew `message` strings.
- Server-side Supabase clients are constructed per-request (`lib/supabase/server.ts`,
  inline in API routes) rather than via a shared singleton — consistent throughout.

## Prioritized action plan

**High — do before resuming active development:**
1. Resolve the pricing-engine vs. `market_prices` split (see above) — decide keep-and-wire
   vs. delete, don't let both keep existing silently.
2. Recover and commit the missing `shopping_trip_participants` table definition; audit
   `supabase/schema.sql` against the live DB and either regenerate it fully or delete it
   in favor of `supabase db dump` so nobody restores from a stale file.
3. Fix `FriendsPanel.tsx`'s `loadFriends` temporal-dead-zone bug (real runtime risk, not
   just lint noise — flagged by `react-hooks/immutability`).
4. Address the 5 high-severity `npm audit` advisories (`next`, `postcss`, `sharp`,
   `fast-xml-parser`, `nanoid`), testing App Router + Cron behavior after upgrading `next`
   past the pinned `16.2.9`.

**Medium:**
5. Fix remaining React Compiler purity violations (`set-state-in-effect`, impure
   `Date.now()` in `HistoryClient.tsx`) — likely to cause visible cascading-render bugs,
   not just lint warnings.
6. Add a `.env.example` documenting the 5 required env vars.
7. Replace the 3 duplicated haversine implementations
   (`compare/route.ts`, `location-engine/nearby-stores`, and the unused
   `location-engine/distance` stub) with one shared implementation, or delete the unused
   ones if System B is deleted per item 1.
8. Remove hardcoded Supabase URL/anon key from `scripts/seed_db.js`; read from env.
9. Add a minimal test setup (even smoke tests for `shopping-engine/optimizer` and
   `pricing-engine/normalizers`, which are pure functions and cheap to test) — currently
   zero test coverage on any logic.

**Low:**
10. Clean up 11 stale merged `worktree-*`/`ecc-tools/*` remote branches.
11. Fix `@typescript-eslint/no-explicit-any` occurrences (`ListDetailClient.tsx`,
    `lists/page.tsx`, `lists/[id]/page.tsx`).
12. Either scope ESLint to exclude `scripts/*.js` from `no-require-imports`, or convert
    those scripts to ESM.
13. Regenerate `README.md` and the two auto-generated `SKILL.md` files (or delete them) —
    they describe conventions the codebase doesn't follow and will mislead future agents;
    this `CLAUDE.md` is now the accurate reference.
