-- Follow-ups and templates: tenant isolation (including cross-tenant lead_id injection), explicit
-- status rules, completion with a next action, auto-skip when a lead closes, and history.
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

select plan(35);

select tests.create_user('alice@a.test', '00000000-0000-0000-0000-00000000000a');
select tests.create_user('adam@a.test',  '00000000-0000-0000-0000-0000000000a1');
select tests.create_user('bob@b.test',   '00000000-0000-0000-0000-00000000000b');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
insert into tests.ids select 'org_a', public.create_organisation('Alpha Cleaning');
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
insert into tests.ids select 'org_b', public.create_organisation('Beta Cleaning');
select tests.clear_authentication();

insert into public.memberships (org_id, user_id, role) values ((select v from tests.ids where k = 'org_a'), '00000000-0000-0000-0000-0000000000a1', 'member');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
with l as (
  insert into public.leads (org_id, name, phone, source) values ((select v from tests.ids where k = 'org_a'), 'Thandi M', '0821234567', 'phone') returning id
)
insert into tests.ids select 'lead_a', id from l;
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
with l as (
  insert into public.leads (org_id, name, email, source) values ((select v from tests.ids where k = 'org_b'), 'Pieter V', 'p@example.test', 'phone') returning id
)
insert into tests.ids select 'lead_b', id from l;
select tests.clear_authentication();

-- ---------------------------------------------------------------- creation rules
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
with f as (
  insert into public.follow_ups (org_id, lead_id, due_at, note)
  values ((select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a'), now() + interval '1 day', 'Call back about quote') returning id
)
insert into tests.ids select 'fu_a', id from f;

select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a') and status = 'open'),
  1, 'a follow-up starts open');
select is((select count(*)::int from public.lead_events where lead_id = (select v from tests.ids where k = 'lead_a') and type = 'follow_up_created'),
  1, 'creating a follow-up is recorded on the lead');
select throws_ok(
  format($q$insert into public.follow_ups (org_id, lead_id, due_at) values (%L, %L, null)$q$, (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a')),
  '23502', null, 'a follow-up must have a due date');
select throws_ok(
  format($q$insert into public.follow_ups (org_id, lead_id, due_at, status) values (%L, %L, now(), 'done')$q$, (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'a follow-up cannot be created already done');
select throws_ok(
  format($q$update public.follow_ups set assigned_to = %L where id = %L$q$, '00000000-0000-0000-0000-00000000000b', (select v from tests.ids where k = 'fu_a')),
  '23514', null, 'a follow-up cannot be assigned to someone outside the organisation');
select throws_ok(
  format($q$select public.complete_follow_up(%L, '   ')$q$, (select v from tests.ids where k = 'fu_a')),
  '22023', null, 'completing a follow-up requires an outcome');
select tests.clear_authentication();

-- ---------------------------------------------------------------- tenant isolation
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.follow_ups where id = (select v from tests.ids where k = 'fu_a')), 0,
  'bob cannot read an org A follow-up by guessing its UUID');
select throws_ok(
  format($q$insert into public.follow_ups (org_id, lead_id, due_at) values (%L, %L, now())$q$, (select v from tests.ids where k = 'org_b'), (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'bob cannot attach a follow-up to an org A lead via his own org id');
select throws_ok(
  format($q$insert into public.follow_ups (org_id, lead_id, due_at) values (%L, %L, now())$q$, (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a')),
  '42501', null, 'bob cannot create a follow-up in org A');
select throws_ok(
  format($q$select public.complete_follow_up(%L, 'hijack')$q$, (select v from tests.ids where k = 'fu_a')),
  'P0002', null, 'bob cannot complete an org A follow-up');
update public.follow_ups set note = 'Hijacked' where id = (select v from tests.ids where k = 'fu_a');
select tests.clear_authentication();
select is((select note from public.follow_ups where id = (select v from tests.ids where k = 'fu_a')), 'Call back about quote',
  'bob cannot edit an org A follow-up');

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.follow_ups', '42501', null, 'anon cannot read follow-ups');
select throws_ok($q$select public.complete_follow_up(gen_random_uuid(), 'x')$q$, '42501', null,
  'anon cannot call complete_follow_up');
select tests.clear_authentication();

-- ---------------------------------------------------------------- completion
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
insert into tests.ids
  select 'fu_next', public.complete_follow_up((select v from tests.ids where k = 'fu_a'), 'Quoted R1500, customer will decide',
                                              now() + interval '3 days', 'Check if they decided');
select ok((select v is not null from tests.ids where k = 'fu_next'),
  'completing with a next action returns the new follow-up');
select is((select status::text from public.follow_ups where id = (select v from tests.ids where k = 'fu_a')), 'done', 'the completed follow-up is done');
select ok((select completed_at is not null and completed_by is not null and outcome is not null
             from public.follow_ups where id = (select v from tests.ids where k = 'fu_a')),
  'completion records when, by whom and the outcome');
select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a') and status = 'open'),
  1, 'the next action is the only open follow-up');
select throws_ok(
  format($q$update public.follow_ups set note = 'edit' where id = %L$q$, (select v from tests.ids where k = 'fu_a')),
  '23514', null, 'a completed follow-up can no longer be edited');
select throws_ok(
  format($q$select public.complete_follow_up(%L, 'again')$q$, (select v from tests.ids where k = 'fu_a')),
  'P0002', null, 'a follow-up cannot be completed twice');
select throws_ok(
  format($q$update public.follow_ups set status = 'done' where id = %L$q$, (select v from tests.ids where k = 'fu_next')),
  '23514', null, 'marking done directly without an outcome is rejected');
select is((select meta ->> 'outcome' from public.lead_events
            where lead_id = (select v from tests.ids where k = 'lead_a') and type = 'follow_up_done'),
  'Quoted R1500, customer will decide', 'the outcome is kept in the lead history');

-- ---------------------------------------------------------------- lead stage vs follow-ups
update public.leads set stage = 'won' where id = (select v from tests.ids where k = 'lead_a');
select is((select outcome from public.follow_ups where id = (select v from tests.ids where k = 'fu_next')),
  'Closed automatically: lead marked won', 'winning a lead skips its open follow-ups');
select throws_ok(
  format($q$insert into public.follow_ups (org_id, lead_id, due_at) values (%L, %L, now())$q$, (select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a')),
  '23514', null, 'a closed lead cannot get a new follow-up');
update public.leads set stage = 'contacted' where id = (select v from tests.ids where k = 'lead_a');
select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a') and status = 'open'),
  0, 'reopening a lead does not resurrect skipped follow-ups');
select tests.clear_authentication();

-- ---------------------------------------------------------------- roles inside a tenant
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
insert into public.follow_ups (org_id, lead_id, due_at, assigned_to)
values ((select v from tests.ids where k = 'org_a'), (select v from tests.ids where k = 'lead_a'), now() + interval '2 days', '00000000-0000-0000-0000-0000000000a1');
delete from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a');
select tests.clear_authentication();
select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a')), 3,
  'a plain member can add follow-ups but cannot delete them');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
delete from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a') and assigned_to = '00000000-0000-0000-0000-0000000000a1';
select tests.clear_authentication();
select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a')), 2, 'an owner can delete a follow-up');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
delete from public.leads where id = (select v from tests.ids where k = 'lead_a');
select tests.clear_authentication();
select is((select count(*)::int from public.follow_ups where lead_id = (select v from tests.ids where k = 'lead_a')), 0,
  'deleting a lead removes its follow-ups');

-- ---------------------------------------------------------------- templates
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
with t as (
  insert into public.templates (org_id, name, body) values ((select v from tests.ids where k = 'org_a'), 'Quote nudge', 'Hi {{customer_name}}') returning id
)
insert into tests.ids select 'tpl_a', id from t;
select tests.clear_authentication();
select is((select count(*)::int from public.templates where org_id = (select v from tests.ids where k = 'org_a')), 1, 'a template can be created');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.templates where org_id = (select v from tests.ids where k = 'org_a')), 0, 'bob cannot read org A templates');
select throws_ok(
  format($q$insert into public.templates (org_id, name, body) values (%L, 'x', 'y')$q$, (select v from tests.ids where k = 'org_a')),
  '42501', null, 'bob cannot create a template in org A');
update public.templates set name = 'Hijacked' where id = (select v from tests.ids where k = 'tpl_a');
select tests.clear_authentication();
select is((select name from public.templates where id = (select v from tests.ids where k = 'tpl_a')),
  'Quote nudge', 'bob cannot edit an org A template');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($q$update public.templates set org_id = %L where id = (select v from tests.ids where k = 'tpl_a')$q$, (select v from tests.ids where k = 'org_b')),
  '42501', null, 'a template cannot be moved to another organisation');
select tests.clear_authentication();

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
insert into public.templates (org_id, name, body) values ((select v from tests.ids where k = 'org_a'), 'Thanks', 'Thank you');
delete from public.templates where org_id = (select v from tests.ids where k = 'org_a');
select tests.clear_authentication();
select is((select count(*)::int from public.templates where org_id = (select v from tests.ids where k = 'org_a')), 2,
  'a plain member can add templates but cannot delete them');

select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
delete from public.templates where id = (select v from tests.ids where k = 'tpl_a');
select tests.clear_authentication();
select is((select count(*)::int from public.templates where org_id = (select v from tests.ids where k = 'org_a')), 1, 'an owner can delete a template');

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.templates', '42501', null, 'anon cannot read templates');
select tests.clear_authentication();

select * from finish();
rollback;
