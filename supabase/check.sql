-- Read-only inspection. Run the entire file in Supabase SQL Editor.
-- No customer messages, Auth emails or intake token hashes are returned.
begin read only;

select name, to_regclass(name) is not null as exists_in_database
from (values ('public.contact_requests'), ('public.authorized_admins'),
             ('private.contact_intake_tokens')) t(name);

select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where (table_schema = 'public' and table_name in ('contact_requests', 'authorized_admins'))
   or (table_schema = 'private' and table_name = 'contact_intake_tokens')
order by table_schema, table_name, ordinal_position;

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('contact_requests', 'authorized_admins');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('contact_requests', 'authorized_admins');

select grantee, table_schema, table_name, privilege_type
from information_schema.table_privileges
where table_schema in ('public', 'private')
and table_name in ('contact_requests', 'authorized_admins', 'contact_intake_tokens')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('contact_requests', 'authorized_admins')
order by table_name, grantee, column_name;

select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as function_settings, p.proacl as execute_grants
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('submit_contact_request', 'is_kindler_admin');

select schemaname, tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('contact_requests', 'authorized_admins');

select n.nspname as crypto_schema from pg_extension e
join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';

commit;
