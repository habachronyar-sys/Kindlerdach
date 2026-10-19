-- MANUAL STEP ONLY. Does not create an Auth user or replace an existing admin.
-- Supabase > Authentication > Users > select your own user > copy User UID.
-- Replace ONLY the placeholder below, then run the entire file in SQL Editor.
begin;
lock table public.authorized_admins in exclusive mode;
do $$
declare
  owner_uid uuid := 'HIER-DIE-USER-UID-EINTRAGEN';
begin
  if not exists (select 1 from auth.users where id = owner_uid) then
    raise exception 'The specified Auth user does not exist.';
  end if;
  if exists (select 1 from public.authorized_admins where user_id <> owner_uid) then
    raise exception 'Another administrator is already authorized. No authorization changed.';
  end if;
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.authorized_admins'::regclass and i.indisunique
      and i.indisvalid and i.indpred is null
      and pg_get_expr(i.indexprs, i.indrelid) = 'true'
  ) then
    raise exception 'Single-administrator unique index missing. Apply the reviewed single-admin migration first.';
  end if;
  insert into public.authorized_admins(user_id) values (owner_uid)
  on conflict (user_id) do nothing;
end;
$$;
commit;
