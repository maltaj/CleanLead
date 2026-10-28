-- Cross-tenant isolation. Two businesses (A and B) plus an outsider with no organisation.
-- Every check attempts access by guessing the other tenant's UUIDs.
begin;
create extension if not exists pgtap with schema extensions;
-- Test helpers (everything here is rolled back at the end).
create schema if not exists tests;

create or replace function tests.create_user(p_email text, p_id uuid default gen_random_uuid())
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (p_id, p_email, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  return p_id;
end;
$$;

create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

create table tests.ids (k text primary key, v uuid not null);
grant all on tests.ids to anon, authenticated;

select plan(26);

select tests.create_user('alice@a.test', '00000000-0000-0000-0000-00000000000a');
select tests.create_user('adam@a.test',  '00000000-0000-0000-0000-0000000000a1');
select tests.create_user('bob@b.test',   '00000000-0000-0000-0000-00000000000b');
select tests.create_user('eve@x.test',   '00000000-0000-0000-0000-00000000000e');

-- Create the organisations through the real entry point.
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
insert into tests.ids select 'org_a', public.create_organisation('Alpha Cleaning');
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
insert into tests.ids select 'org_b', public.create_organisation('Beta Cleaning');
select tests.clear_authentication();

-- Alice adds Adam to A as a plain member (trusted setup, as invitations would do later).
insert into public.memberships (org_id, user_id, role)
values ((select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-0000000000a1', 'member');

-- ---------------------------------------------------------------- creation
select is((select count(*)::int from public.memberships where org_id = (select v from tests.ids where k = 'org_a') and role = 'owner'),
  1, 'create_organisation makes the caller an owner');
select is((select count(*)::int from public.audit_events where org_id = (select v from tests.ids where k = 'org_a')
            and action = 'organisation.created'),
  1, 'create_organisation writes an audit event');

-- ---------------------------------------------------------------- reads
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.organisations), 1, 'alice sees only her organisation');
select is((select count(*)::int from public.organisations where id = (select v from tests.ids where k = 'org_b')), 0,
  'alice cannot read org B by guessing its id');
select is((select count(*)::int from public.memberships where org_id = (select v from tests.ids where k = 'org_b')), 0,
  'alice cannot read org B memberships');
select is((select count(*)::int from public.audit_events where org_id = (select v from tests.ids where k = 'org_b')), 0,
  'alice cannot read org B audit events');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 0,
  'alice cannot read the profile of someone in another organisation');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'alice can read the profile of a teammate');
select tests.clear_authentication();

-- ---------------------------------------------------------------- writes across tenants
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
update public.organisations set name = 'Hijacked' where id = (select v from tests.ids where k = 'org_a');
select tests.clear_authentication();
select is((select name from public.organisations where id = (select v from tests.ids where k = 'org_a')), 'Alpha Cleaning',
  'bob cannot rename org A');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format($q$insert into public.memberships (org_id, user_id, role) values (%L, %L, 'owner')$q$,
         (select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-00000000000b'),
  '42501', null, 'bob cannot insert himself into org A');
select throws_ok(
  format($q$insert into public.organisations (name, slug) values ('Rogue', 'rogue-org')$q$),
  '42501', null, 'clients cannot insert organisations directly');
select throws_ok(
  format($q$select public.log_audit_event(%L, 'x', 'y')$q$, (select v from tests.ids where k = 'org_a')),
  '42501', null, 'clients cannot forge audit events');
delete from public.memberships where org_id = (select v from tests.ids where k = 'org_a');
select tests.clear_authentication();
select is((select count(*)::int from public.memberships where org_id = (select v from tests.ids where k = 'org_a')), 2,
  'bob cannot delete org A memberships');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
update public.memberships set role = 'owner'
 where org_id = (select v from tests.ids where k = 'org_a') and user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.clear_authentication();
select is((select role::text from public.memberships
            where org_id = (select v from tests.ids where k = 'org_a') and user_id = '00000000-0000-0000-0000-0000000000a1'),
  'member', 'bob cannot promote members of org A');

-- ---------------------------------------------------------------- outsider and anon
select tests.authenticate_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.organisations), 0, 'a user with no membership sees no organisations');
select is((select count(*)::int from public.memberships), 0, 'a user with no membership sees no memberships');
select tests.clear_authentication();

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.organisations', '42501', null,
  'anon cannot read organisations');
select throws_ok('select public.create_organisation(''Anon Co'')', '42501', null,
  'anon cannot call create_organisation');
select tests.clear_authentication();

-- ---------------------------------------------------------------- roles inside a tenant
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
update public.organisations set name = 'Member Rename' where id = (select v from tests.ids where k = 'org_a');
select tests.clear_authentication();
select is((select name from public.organisations where id = (select v from tests.ids where k = 'org_a')), 'Alpha Cleaning',
  'a plain member cannot rename the organisation');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.audit_events where org_id = (select v from tests.ids where k = 'org_a')), 0,
  'a plain member cannot read audit events');
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
update public.organisations set name = 'Alpha Cleaning Co' where id = (select v from tests.ids where k = 'org_a');
select is((select name from public.organisations where id = (select v from tests.ids where k = 'org_a')), 'Alpha Cleaning Co',
  'an owner can rename the organisation');
select throws_ok(
  format($q$update public.organisations set deleted_at = now() where id = %L$q$, (select v from tests.ids where k = 'org_a')),
  '42501', null, 'clients cannot set deleted_at directly');
select throws_ok(
  format($q$update public.organisations set slug = 'taken-over' where id = %L$q$, (select v from tests.ids where k = 'org_a')),
  '42501', null, 'clients cannot change the slug');

-- last-owner protection
select throws_ok(
  format($q$delete from public.memberships where org_id = %L and user_id = %L$q$,
         (select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-00000000000a'),
  '23514', null, 'the last owner cannot be removed');
select throws_ok(
  format($q$update public.memberships set role = 'member' where org_id = %L and user_id = %L$q$,
         (select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-00000000000a'),
  '23514', null, 'the last owner cannot be demoted');
select tests.clear_authentication();

-- admins cannot touch owners
update public.memberships set role = 'admin'
 where org_id = (select v from tests.ids where k = 'org_a') and user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  format($q$update public.memberships set role = 'owner' where org_id = %L and user_id = %L$q$,
         (select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-0000000000a1'),
  '42501', null, 'an admin cannot promote themselves to owner');
select tests.clear_authentication();

select * from finish();
rollback;
