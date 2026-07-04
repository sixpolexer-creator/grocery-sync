-- ============================================================
-- Migration: Security & performance audit fixes
-- Based on live Supabase advisor output (security + performance)
-- for project israeli-grocery (guvzhlbbhwcdnobqlvot).
-- Run in the Supabase SQL Editor.
-- ============================================================

-- ── Missing indexes on foreign keys (advisor: unindexed_foreign_keys) ──
create index if not exists friendships_addressee_id_idx on friendships (addressee_id);
create index if not exists items_added_by_idx           on items (added_by);
create index if not exists items_checked_by_idx          on items (checked_by) where checked_by is not null;

-- ── Duplicate unique constraint (advisor: duplicate_index) ──
alter table products drop constraint if exists products_barcode_unique;

-- ── Extension installed in public schema (advisor: extension_in_public) ──
-- Safe: "extensions" is already in the default search_path for every role.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- ── Function search_path mutable (advisor: function_search_path_mutable) ──
create or replace function set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into list_members (list_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create or replace function search_products(query text, max_results integer default 20)
returns table(id uuid, name text, brand text, category text, image_url text)
language sql stable set search_path = public as $$
  select p.id, p.name, p.brand, p.category, p.image_url
  from products p
  where
    p.name  ilike '%' || query || '%'
    or p.brand ilike '%' || query || '%'
  order by
    (p.name ilike query or p.brand ilike query) desc,
    (p.name ilike query || '%')                desc,
    greatest(
      similarity(p.name,  query),
      coalesce(similarity(p.brand, query), 0)
    ) desc,
    p.name
  limit max_results;
$$;

-- ── SECURITY DEFINER trigger functions reachable via PostgREST RPC
--    (advisor: anon/authenticated_security_definer_function_executable).
--    Both only ever run as triggers; Postgres invokes triggers without
--    checking the invoking role's EXECUTE grant, so revoking direct
--    call access closes the /rest/v1/rpc/* endpoint without touching
--    trigger behavior. (is_list_member is intentionally left alone —
--    it's evaluated inside the lists_select RLS policy itself, so the
--    "authenticated" role needs EXECUTE on it for that policy to work.)
revoke execute on function add_owner_as_member() from public, anon, authenticated;
revoke execute on function handle_new_user()      from public, anon, authenticated;

-- ── RLS: wrap auth.<fn>() calls in (select ...) so Postgres evaluates
--    them once per query (initplan) instead of once per row
--    (advisor: auth_rls_initplan). Behavior is unchanged.
alter policy "Users can update own profile" on profiles
  using ((select auth.uid()) = id);

-- profiles: also close a real, unflagged leak — "Users can view all
-- profiles" had qual = true, so the anon key could dump every user's
-- email over PostgREST with no auth. Every screen that reads profiles
-- lives under the authenticated (app) route group, so this is safe.
alter policy "Users can view all profiles" on profiles
  using ((select auth.role()) = 'authenticated');

alter policy "View own friendships" on friendships
  using (((select auth.uid()) = requester_id) or ((select auth.uid()) = addressee_id));
alter policy "Send friend request" on friendships
  with check ((select auth.uid()) = requester_id);
alter policy "Accept/reject friendship" on friendships
  using ((select auth.uid()) = addressee_id);

alter policy "View items of accessible lists" on items
  using (exists (select 1 from list_members where list_members.list_id = items.list_id and list_members.user_id = (select auth.uid())));
alter policy "Add item to accessible list" on items
  with check (exists (select 1 from list_members where list_members.list_id = items.list_id and list_members.user_id = (select auth.uid())));
alter policy "Update item in accessible list" on items
  using (exists (select 1 from list_members where list_members.list_id = items.list_id and list_members.user_id = (select auth.uid())));
alter policy "Delete item" on items
  using (added_by = (select auth.uid()) or exists (select 1 from lists where lists.id = items.list_id and lists.owner_id = (select auth.uid())));

alter policy "lists_select" on lists
  using (owner_id = (select auth.uid()) or is_list_member(id, (select auth.uid())));
alter policy "lists_insert" on lists
  with check ((select auth.uid()) = owner_id);
alter policy "lists_update" on lists
  using ((select auth.uid()) = owner_id);
alter policy "lists_delete" on lists
  using ((select auth.uid()) = owner_id);

alter policy "list_members_select" on list_members
  using (user_id = (select auth.uid()) or (select lists.owner_id from lists where lists.id = list_members.list_id) = (select auth.uid()));
alter policy "list_members_insert" on list_members
  with check ((select auth.uid()) = user_id or (select lists.owner_id from lists where lists.id = list_members.list_id) = (select auth.uid()));
alter policy "list_members_delete" on list_members
  using (user_id = (select auth.uid()) or (select lists.owner_id from lists where lists.id = list_members.list_id) = (select auth.uid()));

alter policy "Anyone can read prices" on market_prices
  using ((select auth.role()) = 'authenticated');

alter policy "View trips for member lists" on shopping_trips
  using (exists (select 1 from list_members where list_members.list_id = shopping_trips.list_id and list_members.user_id = (select auth.uid())));
alter policy "List members can create trips" on shopping_trips
  with check ((select auth.uid()) = completed_by and exists (select 1 from list_members where list_members.list_id = shopping_trips.list_id and list_members.user_id = (select auth.uid())));

alter policy "View trip items" on shopping_trip_items
  using (exists (select 1 from shopping_trips st join list_members lm on lm.list_id = st.list_id where st.id = shopping_trip_items.trip_id and lm.user_id = (select auth.uid())));
alter policy "Insert trip items" on shopping_trip_items
  with check (exists (select 1 from shopping_trips where shopping_trips.id = shopping_trip_items.trip_id and shopping_trips.completed_by = (select auth.uid())));

-- ── Multiple permissive policies for the same role/action
--    (advisor: multiple_permissive_policies) ──

-- products: "Anyone can read products" (authenticated-only) is strictly
-- subsumed by "Auth read products" (qual = true, applies to everyone).
-- Dropping the redundant one is a no-op for effective access.
drop policy if exists "Anyone can read products" on products;

-- presence: "Update own presence" was FOR ALL, which duplicates
-- "View all presence" for SELECT. Split it into the three non-SELECT
-- actions so SELECT is only ever evaluated once.
drop policy if exists "Update own presence" on presence;
create policy "Insert own presence" on presence for insert with check ((select auth.uid()) = user_id);
create policy "Update own presence" on presence for update using ((select auth.uid()) = user_id);
create policy "Delete own presence" on presence for delete using ((select auth.uid()) = user_id);
alter policy "View all presence" on presence
  using ((select auth.role()) = 'authenticated');
