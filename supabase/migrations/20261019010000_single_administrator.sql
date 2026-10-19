-- Run after 20261019000000_kindler_contact_requests.sql.
-- The constant unique index permits at most one authorized identity, including
-- concurrent inserts. Existing multiple administrators cause a safe failure;
-- no account or authorization is silently removed.
begin;
create unique index if not exists authorized_admins_single_administrator
  on public.authorized_admins ((true));
commit;
