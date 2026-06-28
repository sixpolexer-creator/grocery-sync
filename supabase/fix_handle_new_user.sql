-- Run this in Supabase SQL Editor → Run
-- Rewrites the handle_new_user trigger to be defensive

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, avatar_url)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never block auth even if profile insert fails
  return new;
end;
$$;
