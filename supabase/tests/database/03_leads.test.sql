-- Leads: cross-tenant isolation (including guessed UUIDs), event history, outcome dates,
-- reopen behaviour, immutability and assignment rules.
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

select plan(31);

select tests.create_user('alice@a.test', '00000000-0000-0000-0000-00000000000a');
select tests.create_user('adam@a.test',  '00000000-0000-0000-0000-0000000000a1');
select tests.create_user('bob@b.test',   '00000000-0000-0000-0000-00000000000b');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
insert into tests.ids select 'org_a', public.create_organisation('Alpha Cleaning');
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
insert into tests.ids select 'org_b', public.create_organisation('Beta Cleaning');
select tests.clear_authentication();

-- Adam joins A as a plain member (trusted setup, as invitations will do later).
insert into public.memberships (org_id, user_id, role)
values ((select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-0000000000a1', 'member');

-- Alice creates a lead in A; Bob creates one in B.
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
with l as (
  insert into public.leads (org_id, name, phone, source)
  values ((select v from tests.ids where k = 'org_a'), 'Thandi M', '0821234567', 'phone')
  returning id
)
insert into tests.ids select 'lead_a', id from l;
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
with l as (
  insert into public.leads (org_id, name, email, source)
  values ((select v from tests.ids where k = 'org_b'), 'Pieter V', 'pieter@example.test', 'website_form')
  returning id
)
insert into tests.ids select 'lead_b', id from l;
select tests.clear_authentication();

-- ---------------------------------------------------------------- creation rules
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.lead_events
            where lead_id = (select v from tests.ids where k = 'lead_a') and type = 'created'),
  1, 'creating a lead records a created event');
select is((select stage::text || ':' || coalesce(closed_at::text, 'open') from public.leads
            where id = (select v from tests.ids where k = 'lead_a')),
  'new:open', 'a new lead starts at New with no outcome date');
select throws_ok(
  format($q$insert into public.leads (org_id, name, source, stage) values (%L, 'Sneaky', 'phone', 'won')$q$,
         (select v from tests.ids where k = 'org_a')),
  '42501', null, 'a lead cannot be inserted already won');
select throws_ok(
  format($q$insert into public.leads (org_id, name, source) values (%L, 'No contact', 'phone')$q$,
         (select v from tests.ids where k = 'org_a')),
  '23514', null, 'a lead needs a phone or an email');
select throws_ok(
  format($q$insert into public.leads (org_id, name, phone, source) values (%L, 'Bad', '0821234567', 'carrier-pigeon')$q$,
         (select v from tests.ids where k = 'org_a')),
  '22P02', null, 'source must be one of the known sources');
select throws_ok(
  format($q$insert into public.leads (org_id, name, phone, source) values (%L, 'Cross', '0821234567', 'phone')$q$,
         (select v from tests.ids where k = 'org_b')),
  '42501', null, 'alice cannot create a lead in org B');
select tests.clear_authentication();

-- ---------------------------------------------------------------- tenant isolation
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  0, 'bob cannot read org A lead by guessing its UUID');
select is((select count(*)::int from public.lead_events where lead_id = (select v from tests.ids where k = 'lead_a')),
  0, 'bob cannot read org A lead events');
select is((select count(*)::int from public.leads), 1, 'bob sees only his own organisation''s leads');
update public.leads set name = 'Hijacked' where id = (select v from tests.ids where k = 'lead_a');
delete from public.leads where id = (select v from tests.ids where k = 'lead_a');
select throws_ok(
  format($q$update public.leads set org_id = %L where id = %L$q$,
         (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_b')),
  '42501', null, 'bob cannot move his lead into org A');
select tests.clear_authentication();

select is((select name from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  'Thandi M', 'bob cannot rename org A lead');
select is((select count(*)::int from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  1, 'bob cannot delete org A lead');

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.leads', '42501', null, 'anon cannot read leads');
select throws_ok('select count(*) from public.lead_events', '42501', null, 'anon cannot read lead events');
select tests.clear_authentication();

-- ---------------------------------------------------------------- assignment
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($q$update public.leads set assigned_to = %L where id = %L$q$,
         '00000000-0000-0000-0000-00000000000b', (select v from tests.ids where k = 'lead_a')),
  '23514', null, 'a lead cannot be assigned to someone outside the organisation');
update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000a1'
 where id = (select v from tests.ids where k = 'lead_a');
select is((select count(*)::int from public.lead_events
            where lead_id = (select v from tests.ids where k = 'lead_a') and type = 'updated'),
  1, 'assigning a lead to a teammate is recorded');

-- ---------------------------------------------------------------- stages, outcome dates, history
update public.leads set stage = 'contacted' where id = (select v from tests.ids where k = 'lead_a');
update public.leads set stage = 'quote_sent' where id = (select v from tests.ids where k = 'lead_a');
update public.leads set stage = 'won' where id = (select v from tests.ids where k = 'lead_a');
select ok((select closed_at is not null from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  'marking a lead won records the outcome date');

update public.leads set stage = 'contacted' where id = (select v from tests.ids where k = 'lead_a');
select ok((select closed_at is null from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  'reopening a lead clears the outcome date');
select is((select meta ->> 'previous_outcome' from public.lead_events
            where lead_id = (select v from tests.ids where k = 'lead_a') and type = 'reopened'),
  'won', 'the reopen event preserves the previous outcome');
select is((select count(*)::int from public.lead_events where lead_id = (select v from tests.ids where k = 'lead_a')),
  6, 'history is intact: created, assigned, contacted, quote sent, won, reopened');

select throws_ok(
  format($q$update public.leads set lost_reason = 'x' where id = %L$q$, (select v from tests.ids where k = 'lead_a')),
  '23514', null, 'a lost reason is only allowed on lost leads');
update public.leads set stage = 'lost', lost_reason = 'Too expensive'
 where id = (select v from tests.ids where k = 'lead_a');
select is((select closed_at is not null from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  true, 'losing a lead records the outcome date');
select is((select meta ->> 'lost_reason' from public.lead_events
            where lead_id = (select v from tests.ids where k = 'lead_a') and to_stage = 'lost'
            order by id desc limit 1),
  'Too expensive', 'the loss reason is kept in history');
update public.leads set stage = 'new' where id = (select v from tests.ids where k = 'lead_a');
select ok((select lost_reason is null and closed_at is null from public.leads
            where id = (select v from tests.ids where k = 'lead_a')),
  'reopening a lost lead clears the live reason and outcome date');

select throws_ok(
  format($q$update public.leads set closed_at = now() where id = %L$q$, (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'clients cannot set the outcome date directly');

-- ---------------------------------------------------------------- history is append-only
select throws_ok(
  format($q$insert into public.lead_events (org_id, lead_id, type) values (%L, %L, 'updated')$q$,
         (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'clients cannot write lead events');
select throws_ok(
  format($q$update public.lead_events set type = 'created' where lead_id = %L$q$, (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'clients cannot edit lead events');
select throws_ok(
  format($q$delete from public.lead_events where lead_id = %L$q$, (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'clients cannot delete lead events');
select tests.clear_authentication();

-- ---------------------------------------------------------------- roles inside a tenant
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
insert into public.leads (org_id, name, phone, source)
values ((select v from tests.ids where k = 'org_a'), 'Added by member', '0831112222', 'whatsapp');
delete from public.leads where id = (select v from tests.ids where k = 'lead_a');
select tests.clear_authentication();
select is((select count(*)::int from public.leads where org_id = (select v from tests.ids where k = 'org_a')),
  2, 'a plain member can add leads but cannot delete them');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
delete from public.leads where id = (select v from tests.ids where k = 'lead_a');
select tests.clear_authentication();
select is((select count(*)::int from public.leads where id = (select v from tests.ids where k = 'lead_a')),
  0, 'an owner can delete a lead');
select is((select count(*)::int from public.lead_events where lead_id = (select v from tests.ids where k = 'lead_a')),
  0, 'deleting a lead removes its history (erasure requests)');

select * from finish();
rollback;
