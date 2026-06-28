-- ============================================================
-- GrocerySync — Production Schema v2
-- Run in the Supabase SQL Editor (replace v1 schema)
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- fuzzy product search
create extension if not exists "unaccent";  -- accent-insensitive search

-- ============================================================
-- ENUMS
-- ============================================================
create type friendship_status as enum ('pending', 'accepted');
create type member_role       as enum ('owner', 'member');
create type user_status       as enum ('online', 'offline');
create type sync_status       as enum ('success', 'partial', 'failed');

-- ============================================================
-- MARKET DATA — Chains, Stores, Manufacturers, Categories
-- ============================================================

create table chains (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  logo_url    text,
  website_url text,
  created_at  timestamptz default now() not null
);

create table stores (
  id          uuid primary key default uuid_generate_v4(),
  chain_id    uuid not null references chains(id) on delete cascade,
  store_code  text not null,
  name        text,
  city        text,
  address     text,
  lat         numeric(9,6),
  lon         numeric(9,6),
  is_active   boolean default true not null,
  created_at  timestamptz default now() not null,
  unique (chain_id, store_code)
);

create table manufacturers (
  id              uuid primary key default uuid_generate_v4(),
  name            text unique not null,
  normalized_name text not null,
  website_url     text,
  image_base_url  text,
  created_at      timestamptz default now() not null
);

create table categories (
  id         uuid primary key default uuid_generate_v4(),
  parent_id  uuid references categories(id),
  name       text not null,
  slug       text unique not null,
  level      int  not null default 1,
  created_at timestamptz default now() not null
);

-- ============================================================
-- PRODUCTS — barcode as canonical identifier
-- ============================================================

create table products (
  id              uuid primary key default uuid_generate_v4(),
  barcode         text unique,                          -- null only when no barcode in feed
  name            text not null,
  normalized_name text not null,
  manufacturer_id uuid references manufacturers(id),
  manufacturer    text,                                 -- denormalized for fast reads
  category_id     uuid references categories(id),
  category        text,                                 -- denormalized slug
  unit            text,
  package_size    numeric(10,3),
  package_unit    text,
  image_url       text,                                 -- set by image-sync job
  image_cached_at timestamptz,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

-- Indexes for search
create index products_barcode_idx        on products (barcode) where barcode is not null;
create index products_normalized_name_idx on products (normalized_name);
create index products_name_trgm_idx      on products using gin (name gin_trgm_ops);
create index products_name_fts_idx       on products using gin (to_tsvector('simple', name));
create unique index products_name_nobarcode_idx
  on products (normalized_name) where barcode is null;

-- ============================================================
-- PRODUCT ALIASES — same item, different name per chain
-- ============================================================

create table product_aliases (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references products(id) on delete cascade,
  chain_id       uuid not null references chains(id)   on delete cascade,
  alias_name     text not null,
  alias_barcode  text,
  created_at     timestamptz default now() not null,
  unique (chain_id, alias_barcode)
);

-- ============================================================
-- PRICES — one row per product × store, updated daily
-- ============================================================

create table prices (
  id            uuid primary key default uuid_generate_v4(),
  product_id    uuid not null references products(id) on delete cascade,
  store_id      uuid not null references stores(id)   on delete cascade,
  price         numeric(10,2) not null,
  unit_price    numeric(10,4),
  unit_measure  text,
  scraped_at    timestamptz default now() not null,
  unique (product_id, store_id)
);

create index prices_product_idx on prices (product_id);
create index prices_store_idx   on prices (store_id);
create index prices_scraped_idx on prices (scraped_at);

-- ============================================================
-- PROMOTIONS
-- ============================================================

create table promotions (
  id             uuid primary key default uuid_generate_v4(),
  chain_id       uuid not null references chains(id) on delete cascade,
  promo_id       text not null,
  barcode        text,
  description    text not null,
  discount_price numeric(10,2),
  min_qty        int,
  valid_from     timestamptz,
  valid_to       timestamptz,
  scraped_at     timestamptz default now() not null,
  unique (chain_id, promo_id, barcode)
);

create index promotions_chain_idx  on promotions (chain_id);
create index promotions_barcode_idx on promotions (barcode) where barcode is not null;
create index promotions_valid_idx   on promotions (valid_from, valid_to);

-- ============================================================
-- SYNC LOG
-- ============================================================

create table sync_log (
  id                 uuid primary key default uuid_generate_v4(),
  started_at         timestamptz not null,
  finished_at        timestamptz,
  status             sync_status default 'success' not null,
  products_upserted  int default 0,
  prices_upserted    int default 0,
  errors             jsonb default '[]',
  created_at         timestamptz default now() not null
);

-- ============================================================
-- USER TABLES (unchanged from v1)
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null,
  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

create table friendships (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references profiles(id) on delete cascade,
  addressee_id  uuid not null references profiles(id) on delete cascade,
  status        friendship_status default 'pending' not null,
  created_at    timestamptz default now() not null,
  unique (requester_id, addressee_id),
  check (requester_id != addressee_id)
);

create table lists (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  is_active   boolean default true not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table list_members (
  list_id    uuid not null references lists(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       member_role default 'member' not null,
  joined_at  timestamptz default now() not null,
  primary key (list_id, user_id)
);

create table items (
  id          uuid primary key default uuid_generate_v4(),
  list_id     uuid not null references lists(id) on delete cascade,
  added_by    uuid not null references profiles(id),
  name        text not null,
  quantity    numeric default 1 not null,
  unit        text,
  checked     boolean default false not null,
  checked_by  uuid references profiles(id),
  checked_at  timestamptz,
  product_id  uuid references products(id),   -- links to market-data products
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table purchase_history (
  id            uuid primary key default uuid_generate_v4(),
  list_id       uuid not null references lists(id),
  user_id       uuid not null references profiles(id),
  total_spent   numeric(10,2),
  receipt_url   text,
  purchased_at  timestamptz default now() not null
);

create table presence (
  user_id    uuid primary key references profiles(id) on delete cascade,
  last_seen  timestamptz default now() not null,
  status     user_status default 'online' not null
);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure handle_new_user();

create or replace function add_owner_as_member()
returns trigger language plpgsql security definer as $$
begin
  insert into list_members (list_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger on_list_created
  after insert on lists for each row execute procedure add_owner_as_member();

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on profiles for each row execute procedure set_updated_at();
create trigger lists_updated_at    before update on lists    for each row execute procedure set_updated_at();
create trigger items_updated_at    before update on items    for each row execute procedure set_updated_at();
create trigger products_updated_at before update on products for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles         enable row level security;
alter table friendships      enable row level security;
alter table lists            enable row level security;
alter table list_members     enable row level security;
alter table items            enable row level security;
alter table purchase_history enable row level security;
alter table presence         enable row level security;

-- Market-data tables: read-only for all authenticated users
alter table chains           enable row level security;
alter table stores           enable row level security;
alter table manufacturers    enable row level security;
alter table categories       enable row level security;
alter table products         enable row level security;
alter table prices           enable row level security;
alter table promotions       enable row level security;
alter table sync_log         enable row level security;

-- Profiles
create policy "Public profile read"   on profiles for select using (true);
create policy "Own profile update"    on profiles for update using (auth.uid() = id);

-- Friendships
create policy "View own friendships"  on friendships for select using (auth.uid() in (requester_id, addressee_id));
create policy "Send friend request"   on friendships for insert  with check (auth.uid() = requester_id);
create policy "Respond to request"    on friendships for update  using (auth.uid() = addressee_id);

-- Lists
create policy "View member lists"     on lists for select using (exists (select 1 from list_members where list_id = id and user_id = auth.uid()));
create policy "Create list"           on lists for insert  with check (auth.uid() = owner_id);
create policy "Owner update list"     on lists for update  using (auth.uid() = owner_id);
create policy "Owner delete list"     on lists for delete  using (auth.uid() = owner_id);

-- List members
create policy "View list members"     on list_members for select using (exists (select 1 from list_members lm where lm.list_id = list_id and lm.user_id = auth.uid()));
create policy "Owner add members"     on list_members for insert  with check (exists (select 1 from lists where id = list_id and owner_id = auth.uid()));
create policy "Owner remove members"  on list_members for delete  using (exists (select 1 from lists where id = list_id and owner_id = auth.uid()) or user_id = auth.uid());

-- Items
create policy "View list items"       on items for select using (exists (select 1 from list_members where list_id = items.list_id and user_id = auth.uid()));
create policy "Add item"              on items for insert  with check (exists (select 1 from list_members where list_id = items.list_id and user_id = auth.uid()));
create policy "Update item"           on items for update  using (exists (select 1 from list_members where list_id = items.list_id and user_id = auth.uid()));
create policy "Delete item"           on items for delete  using (added_by = auth.uid() or exists (select 1 from lists where id = items.list_id and owner_id = auth.uid()));

-- Purchase history
create policy "View own history"      on purchase_history for select using (auth.uid() = user_id);
create policy "Insert own history"    on purchase_history for insert  with check (auth.uid() = user_id);

-- Presence
create policy "View all presence"     on presence for select using (auth.role() = 'authenticated');
create policy "Own presence"          on presence for all    using (auth.uid() = user_id);

-- Market data: authenticated read-only
create policy "Auth read chains"       on chains        for select using (auth.role() = 'authenticated');
create policy "Auth read stores"       on stores        for select using (auth.role() = 'authenticated');
create policy "Auth read manufacturers" on manufacturers for select using (auth.role() = 'authenticated');
create policy "Auth read categories"   on categories    for select using (auth.role() = 'authenticated');
create policy "Auth read products"     on products      for select using (auth.role() = 'authenticated');
create policy "Auth read prices"       on prices        for select using (auth.role() = 'authenticated');
create policy "Auth read promotions"   on promotions    for select using (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table list_members;
alter publication supabase_realtime add table presence;
alter publication supabase_realtime add table lists;

-- ============================================================
-- STORAGE — receipts bucket
-- Dashboard: Storage → New bucket → "receipts" (public: true)
-- ============================================================
