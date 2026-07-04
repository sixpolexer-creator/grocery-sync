-- ============================================================
-- Security fix: is_list_member() was publicly callable via RPC
-- Run in the Supabase SQL Editor (or via Supabase MCP apply_migration)
-- ============================================================
--
-- `public.is_list_member(p_list_id uuid, p_user_id uuid)` is a
-- SECURITY DEFINER helper used internally by the "lists_select" RLS
-- policy on `lists`. Because it lived in the `public` schema with
-- EXECUTE granted to `anon` and `authenticated`, PostgREST auto-exposed
-- it at /rest/v1/rpc/is_list_member -- letting ANY caller, including
-- unauthenticated (anon) requests, pass an arbitrary list_id/user_id
-- pair and learn whether that user belongs to that list. That's an
-- IDOR / membership-enumeration leak with no auth required.
--
-- Fix: move the function to a `private` schema PostgREST does not
-- route (it only exposes schemas listed in db-schemas, which is
-- `public` by default), and drop anon/public's EXECUTE grant. RLS
-- policy quals are bound to the function by OID, not schema-qualified
-- name, so moving schema does not require recreating the policy.

create schema if not exists private;

revoke execute on function public.is_list_member(uuid, uuid) from public, anon, authenticated;

alter function public.is_list_member(uuid, uuid) set schema private;

grant execute on function private.is_list_member(uuid, uuid) to authenticated;
