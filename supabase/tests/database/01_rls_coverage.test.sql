-- Structural guard: every table in public must have RLS enabled and forced, anon must have no
-- access, and every table with an org_id must have a policy that references the helper functions.
-- New tenant tables fail this file until they are secured.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not (select c.relrowsecurity from pg_class c
               where c.oid = format('public.%I', t.tablename)::regclass)),
  0,
  'every public table has row level security enabled'
);

select is(
  (select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not (select c.relforcerowsecurity from pg_class c
               where c.oid = format('public.%I', t.tablename)::regclass)),
  0,
  'every public table forces row level security'
);

select is(
  (select count(*)::int
     from information_schema.table_privileges
    where table_schema = 'public' and grantee = 'anon'),
  0,
  'anon holds no privileges on public tables'
);

select is(
  (select count(*)::int
     from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'org_id'
      -- Service-only tables (no client privileges at all) need no client policies.
      and coalesce(has_table_privilege('authenticated', to_regclass(format('public.%I', c.table_name)), 'select,insert,update,delete'), false)
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.table_name
          and (p.qual ~ 'is_member|has_role' or p.with_check ~ 'is_member|has_role')
      )),
  0,
  'every client-accessible table with an org_id has membership-based policies'
);

select is(
  (select count(*)::int
     from pg_policies p
    where p.schemaname = 'public'
      and p.qual ~ 'org_id\s*=\s*\(select|current_setting|user_metadata'),
  0,
  'no policy trusts client-controlled claims or settings for tenancy'
);

select * from finish();
rollback;
