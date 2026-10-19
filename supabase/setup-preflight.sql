-- Run inside the setup transaction, BEFORE any CREATE/GRANT/REVOKE.
-- Fresh installations only: an existing installation must be inspected first.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or to_regclass('auth.users') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'Supabase Auth prerequisites missing. No setup changes applied.';
  end if;
  if to_regclass('public.contact_requests') is not null
     or to_regclass('public.authorized_admins') is not null
     or exists (select 1 from pg_namespace where nspname = 'private')
     or exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('submit_contact_request', 'is_kindler_admin')
     ) then
    raise exception 'Existing objects detected. Run supabase/check.sql and inspect the existing setup first. No setup changes applied.';
  end if;
  if exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname <> 'extensions'
  ) then
    raise exception 'pgcrypto is outside extensions. Inspect dependencies first; no extension is moved by this setup.';
  end if;
end;
$$;
