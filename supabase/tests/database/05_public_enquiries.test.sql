-- Public enquiry form: service-role-only write path, rate limits, consent, tenant isolation.
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

create table tests.ids (k text primary key, v uuid not null);

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
grant all on tests.ids to anon, authenticated;
select plan(19);

select tests.create_user('alice@a.test', '00000000-0000-0000-0000-00000000000a');
select tests.create_user('bob@b.test',   '00000000-0000-0000-0000-00000000000b');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
insert into tests.ids select 'org_a', public.create_organisation('Alpha Cleaning');
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
insert into tests.ids select 'org_b', public.create_organisation('Beta Cleaning');
select tests.clear_authentication();

update public.organisations set slug = 'alpha-test' where id = (select v from tests.ids where k = 'org_a');
update public.organisations set slug = 'beta-test'  where id = (select v from tests.ids where k = 'org_b');

-- ---------------------------------------------------------------- no direct access
select tests.authenticate_as_anon();
select throws_ok(
  $q$select public.submit_public_enquiry('alpha-test','X','0821234567',null,null,null,null,'hash-aaaaaaaaaaaaaaaa',true)$q$,
  '42501', null, 'anon cannot call the submit function directly');
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $q$select public.submit_public_enquiry('alpha-test','X','0821234567',null,null,null,null,'hash-aaaaaaaaaaaaaaaa',true)$q$,
  '42501', null, 'signed-in users cannot call the submit function directly');
select tests.clear_authentication();

select tests.authenticate_as_anon();
select throws_ok($q$select * from public.public_form_info('alpha-test')$q$,
  '42501', null, 'anon cannot call public_form_info directly');
select throws_ok('select count(*) from public.public_enquiry_attempts',
  '42501', null, 'anon cannot read abuse bookkeeping');
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select throws_ok('select count(*) from public.public_enquiry_attempts',
  '42501', null, 'signed-in users cannot read abuse bookkeeping');
select tests.clear_authentication();

-- ---------------------------------------------------------------- disabled by default
set local role service_role;
select is(public.submit_public_enquiry('alpha-test','Lerato','0821234567',null,'Gardens',null,'Need a deep clean','hash-aaaaaaaaaaaaaaaa',true),
  'not_found', 'a business with the form disabled accepts nothing');
select is((select count(*)::int from public.public_form_info('alpha-test')), 0,
  'a disabled form exposes no business details');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
update public.organisations set public_form_enabled = true where id = (select v from tests.ids where k = 'org_a');
select tests.clear_authentication();

-- ---------------------------------------------------------------- happy path
set local role service_role;
select is((select org_name from public.public_form_info('alpha-test')), 'Alpha Cleaning',
  'an enabled form exposes only the business name');
select is(public.submit_public_enquiry('alpha-test','Lerato','0821234567',null,'Gardens','Deep clean','Need a deep clean','hash-aaaaaaaaaaaaaaaa',true),
  'ok', 'a valid enquiry is accepted');
select is(public.submit_public_enquiry('unknown-biz','Lerato','0821234567',null,null,null,null,'hash-aaaaaaaaaaaaaaaa',true),
  'not_found', 'an unknown business is indistinguishable from a disabled one');
reset role;

select ok((select source = 'website_form' and stage = 'new' and consent_at is not null
             and org_id = (select v from tests.ids where k = 'org_a')
           from public.leads where name = 'Lerato'),
  'the lead is created in the right organisation as a new website_form lead with consent recorded');
select is((select count(*)::int from public.lead_events e join public.leads l on l.id = e.lead_id
            where l.name = 'Lerato' and e.type = 'created'),
  1, 'the enquiry leaves a created event in history');

-- ---------------------------------------------------------------- validation
set local role service_role;
select throws_ok(
  $q$select public.submit_public_enquiry('alpha-test','NoConsent','0821234567',null,null,null,null,'hash-bbbbbbbbbbbbbbbb',false)$q$,
  '22023', null, 'consent is required');
select throws_ok(
  $q$select public.submit_public_enquiry('alpha-test','NoContact',null,null,null,null,null,'hash-bbbbbbbbbbbbbbbb',true)$q$,
  '23514', null, 'a phone or email is required');

-- ---------------------------------------------------------------- rate limits
do $$
begin
  for i in 1..4 loop
    perform public.submit_public_enquiry('alpha-test','Repeat ' || i,'0821234567',null,null,null,null,'hash-aaaaaaaaaaaaaaaa',true);
  end loop;
end $$;
select is(public.submit_public_enquiry('alpha-test','Too many','0821234567',null,null,null,null,'hash-aaaaaaaaaaaaaaaa',true),
  'rate_limited', 'the sixth enquiry in an hour from one address is refused');
select is(public.submit_public_enquiry('alpha-test','Other person','0821234567',null,null,null,null,'hash-cccccccccccccccc',true),
  'ok', 'a different address is still accepted');
reset role;

insert into public.public_enquiry_attempts (org_id, ip_hash)
select (select v from tests.ids where k = 'org_a'), 'flood-' || lpad(g::text, 16, '0') from generate_series(1, 100) g;
set local role service_role;
select is(public.submit_public_enquiry('alpha-test','Flood','0821234567',null,null,null,null,'hash-dddddddddddddddd',true),
  'rate_limited', 'a flood across many addresses hits the organisation-wide cap');
reset role;

-- ---------------------------------------------------------------- tenant isolation
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.leads), 0, 'org B cannot see enquiries that arrived for org A');
select throws_ok(
  format($q$insert into public.leads (org_id, name, phone, source, consent_at) values (%L, 'Forged', '0821234567', 'website_form', now())$q$,
         (select v from tests.ids where k = 'org_b')),
  '42501', null, 'signed-in users cannot forge the consent timestamp');
select tests.clear_authentication();

select * from finish();
rollback;
