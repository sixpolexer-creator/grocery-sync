-- Break RLS recursion between shopping_trips and shopping_trip_participants.
-- shopping_trips' SELECT policy queried shopping_trip_participants, whose SELECT
-- policy queried back into shopping_trips, causing Postgres to raise
-- "infinite recursion detected in policy for relation shopping_trips" on any
-- insert/select touching shopping_trips (including the INSERT ... RETURNING
-- used by the shopping-mode finish handler). Route the participant check
-- through a SECURITY DEFINER function (same pattern as private.is_list_member)
-- so it bypasses RLS instead of recursing back into the policy.
-- Applied directly to production via Supabase MCP on 2026-07-04; this file
-- tracks it in version control alongside the other migrations in this folder.

create or replace function private.is_trip_participant(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from shopping_trip_participants
    where trip_id = p_trip_id and user_id = p_user_id
  );
$$;

revoke all on function private.is_trip_participant(uuid, uuid) from public;
grant execute on function private.is_trip_participant(uuid, uuid) to authenticated;

drop policy if exists "View own or shared trips" on shopping_trips;
create policy "View own or shared trips" on shopping_trips
  for select
  using (
    completed_by = (select auth.uid())
    or private.is_trip_participant(id, (select auth.uid()))
  );
