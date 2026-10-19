begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.contact_intake_tokens (
  singleton boolean primary key default true check (singleton),
  token_hash bytea not null
);
revoke all on table private.contact_intake_tokens from public, anon, authenticated;

create table if not exists public.authorized_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.authorized_admins enable row level security;
create unique index if not exists authorized_admins_single_administrator
  on public.authorized_admins ((true));
revoke all on table public.authorized_admins from public, anon, authenticated;
grant select on table public.authorized_admins to authenticated;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(btrim(name)) between 1 and 100),
  phone text check (phone is null or length(phone) <= 40),
  email text check (email is null or (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  subject text not null check (subject in (
    'Allgemeine Anfrage',
    'Dachdeckung & Sanierung',
    'Abdichtung & Flachdach',
    'Dachfenster & Gauben',
    'Reparatur & Wartung',
    'Dämmung & energetische Sanierung',
    'Dachrinnen & Entwässerung',
    'Blech-, Metall- & Schieferarbeiten',
    'Extensive Dachbegrünung'
  )),
  message text not null check (length(btrim(message)) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'archived')),
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint contact_request_requires_contact check (phone is not null or email is not null)
);
alter table public.contact_requests enable row level security;
revoke all on table public.contact_requests from public, anon, authenticated;
grant select, delete on table public.contact_requests to authenticated;
grant update (status, read_at) on table public.contact_requests to authenticated;

create index if not exists contact_requests_created_at_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_status_created_at_idx on public.contact_requests (status, created_at desc);

create or replace function public.is_kindler_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.authorized_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_kindler_admin() from public, anon, authenticated;
grant execute on function public.is_kindler_admin() to authenticated;

drop policy if exists "Admins can view their own authorization" on public.authorized_admins;
drop policy if exists "Admins can view contact requests" on public.contact_requests;
drop policy if exists "Admins can update contact requests" on public.contact_requests;
drop policy if exists "Admins can delete contact requests" on public.contact_requests;

create policy "Admins can view their own authorization"
  on public.authorized_admins for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Admins can view contact requests"
  on public.contact_requests for select to authenticated
  using ((select public.is_kindler_admin()));
create policy "Admins can update contact requests"
  on public.contact_requests for update to authenticated
  using ((select public.is_kindler_admin()))
  with check ((select public.is_kindler_admin()));
create policy "Admins can delete contact requests"
  on public.contact_requests for delete to authenticated
  using ((select public.is_kindler_admin()));

create or replace function private.touch_contact_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_contact_request_updated_at() from public, anon, authenticated;

drop trigger if exists contact_requests_touch_updated_at on public.contact_requests;
create trigger contact_requests_touch_updated_at
  before update on public.contact_requests
  for each row execute function private.touch_contact_request_updated_at();

create or replace function public.submit_contact_request(
  p_intake_token text,
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_intake_token is null or not exists (
    select 1 from private.contact_intake_tokens
    where token_hash = extensions.digest(convert_to(p_intake_token, 'UTF8'), 'sha256')
  ) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 100
     or p_message is null or length(btrim(p_message)) not between 10 and 4000
     or p_subject is null or p_subject not in (
       'Allgemeine Anfrage',
       'Dachdeckung & Sanierung',
       'Abdichtung & Flachdach',
       'Dachfenster & Gauben',
       'Reparatur & Wartung',
       'Dämmung & energetische Sanierung',
       'Dachrinnen & Entwässerung',
       'Blech-, Metall- & Schieferarbeiten',
       'Extensive Dachbegrünung'
     )
     or (p_email is not null and (length(p_email) > 254 or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
     or (p_phone is not null and (length(p_phone) > 40 or p_phone !~ '^\+?[0-9][0-9 ()/.-]{5,38}$'
       or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 6))
     or (nullif(btrim(p_email), '') is null and nullif(btrim(p_phone), '') is null) then
    raise exception using errcode = '22023', message = 'Invalid contact request';
  end if;

  insert into public.contact_requests (name, email, phone, subject, message)
  values (
    btrim(p_name),
    nullif(lower(btrim(p_email)), ''),
    nullif(btrim(p_phone), ''),
    p_subject,
    btrim(p_message)
  );
end;
$$;
revoke all on function public.submit_contact_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, text, text) to anon;

commit;
