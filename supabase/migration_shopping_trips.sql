-- ============================================================
-- Migration: Replace purchase_history with shared shopping trips
-- Run in Supabase SQL Editor
-- ============================================================

-- Drop old table (safe to drop — new schema replaces it)
drop table if exists purchase_history cascade;

-- ── shopping_trips ────────────────────────────────────────────
create table shopping_trips (
  id            uuid primary key default uuid_generate_v4(),
  list_id       uuid not null references lists(id) on delete cascade,
  completed_by  uuid not null references profiles(id),
  total_amount  numeric(10,2),
  created_at    timestamptz default now() not null
);

create index shopping_trips_list_idx on shopping_trips (list_id);
create index shopping_trips_user_idx on shopping_trips (completed_by);

-- ── shopping_trip_items ───────────────────────────────────────
create table shopping_trip_items (
  id         uuid primary key default uuid_generate_v4(),
  trip_id    uuid not null references shopping_trips(id) on delete cascade,
  item_name  text not null,
  quantity   numeric default 1 not null,
  unit       text,
  brand      text,
  category   text
);

create index trip_items_trip_idx on shopping_trip_items (trip_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table shopping_trips      enable row level security;
alter table shopping_trip_items enable row level security;

-- Any list member can view trips for their shared lists
create policy "View trips for member lists"
  on shopping_trips for select
  using (
    exists (
      select 1 from list_members
      where list_members.list_id = shopping_trips.list_id
        and list_members.user_id = auth.uid()
    )
  );

-- Only list members can insert trips
create policy "List members can create trips"
  on shopping_trips for insert
  with check (
    auth.uid() = completed_by
    and exists (
      select 1 from list_members
      where list_members.list_id = shopping_trips.list_id
        and list_members.user_id = auth.uid()
    )
  );

-- Trip items: readable by anyone who can read the trip
create policy "View trip items"
  on shopping_trip_items for select
  using (
    exists (
      select 1
      from shopping_trips st
      join list_members lm on lm.list_id = st.list_id
      where st.id = shopping_trip_items.trip_id
        and lm.user_id = auth.uid()
    )
  );

-- Trip items: insertable by the trip creator
create policy "Insert trip items"
  on shopping_trip_items for insert
  with check (
    exists (
      select 1 from shopping_trips
      where id = trip_id and completed_by = auth.uid()
    )
  );
