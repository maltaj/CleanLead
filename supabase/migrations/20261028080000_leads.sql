-- CleanLead: leads, stages and the append-only lead_events history.
-- Stages are a simple pipeline. Follow-ups are a separate entity (next milestone), so
-- "follow-up due" is never a stage and cannot contradict the lead's stage.

create type public.lead_stage as enum ('new', 'contacted', 'quote_sent', 'won', 'lost');

create type public.lead_source as enum (
  'phone', 'whatsapp', 'website_form', 'referral', 'walk_in', 'social', 'other'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) between 6 and 25),
  email text check (email is null or char_length(email) between 3 and 254),
  suburb text check (suburb is null or char_length(suburb) <= 80),
  service_type text not null default 'General cleaning'
    check (char_length(btrim(service_type)) between 1 and 80),
  est_value_cents integer check (est_value_cents is null or est_value_cents between 0 and 100000000),
  source public.lead_source not null,
  stage public.lead_stage not null default 'new',
  assigned_to uuid references auth.users (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  lost_reason text check (lost_reason is null or char_length(lost_reason) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Outcome date: set when a lead is won or lost, cleared if it is reopened.
  closed_at timestamptz,
  constraint leads_contact_required check (phone is not null or email is not null),
  constraint leads_closed_matches_stage check ((stage in ('won', 'lost')) = (closed_at is not null)),
  constraint leads_lost_reason_only_when_lost check (lost_reason is null or stage = 'lost')
);

create index leads_org_stage_idx on public.leads (org_id, stage);
create index leads_org_created_idx on public.leads (org_id, created_at desc);
create index leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;

-- Append-only history. Rows are written only by the trigger below; clients can only read.
create table public.lead_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('created', 'stage_changed', 'reopened', 'updated')),
  from_stage public.lead_stage,
  to_stage public.lead_stage,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
create index lead_events_org_idx on public.lead_events (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity: org_id is immutable, assignee must belong to the organisation,
-- closed_at and updated_at are maintained by the database.
-- ---------------------------------------------------------------------------
create function public.leads_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'org_id cannot be changed' using errcode = '42501';
  end if;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    if not exists (
      select 1 from public.memberships
      where org_id = new.org_id and user_id = new.assigned_to
    ) then
      raise exception 'assignee must be a member of the organisation' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.closed_at := case when new.stage in ('won', 'lost') then now() else null end;
  else
    new.updated_at := now();
    if new.stage is distinct from old.stage then
      if new.stage in ('won', 'lost') then
        new.closed_at := now();
      else
        new.closed_at := null;
      end if;
      if new.stage <> 'lost' then
        new.lost_reason := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger leads_before_write
  before insert or update on public.leads
  for each row execute function public.leads_before_write();

-- ---------------------------------------------------------------------------
-- History: every creation and stage change leaves an event. Reopening a closed
-- lead is a new event, so earlier outcomes are never lost.
-- ---------------------------------------------------------------------------
create function public.leads_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_type text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (org_id, lead_id, actor_id, type, to_stage, meta)
    values (new.org_id, new.id, v_actor, 'created', new.stage,
            jsonb_build_object('source', new.source));
    return new;
  end if;

  if new.stage is distinct from old.stage then
    if old.stage in ('won', 'lost') and new.stage not in ('won', 'lost') then
      v_type := 'reopened';
      v_meta := jsonb_build_object('previous_outcome', old.stage, 'previous_closed_at', old.closed_at,
                                   'previous_lost_reason', old.lost_reason);
    else
      v_type := 'stage_changed';
      if new.stage = 'lost' and new.lost_reason is not null then
        v_meta := jsonb_build_object('lost_reason', new.lost_reason);
      end if;
    end if;
    insert into public.lead_events (org_id, lead_id, actor_id, type, from_stage, to_stage, meta)
    values (new.org_id, new.id, v_actor, v_type, old.stage, new.stage, v_meta);
  elsif new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_events (org_id, lead_id, actor_id, type, meta)
    values (new.org_id, new.id, v_actor, 'updated',
            jsonb_build_object('field', 'assigned_to', 'from', old.assigned_to, 'to', new.assigned_to));
  end if;
  return new;
end;
$$;

create trigger leads_after_write
  after insert or update on public.leads
  for each row execute function public.leads_after_write();

revoke all on function public.leads_before_write() from public, anon, authenticated;
revoke all on function public.leads_after_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.leads force row level security;
alter table public.lead_events force row level security;

revoke all on public.leads, public.lead_events from authenticated;
grant select on public.leads, public.lead_events to authenticated;
-- org_id, created_by, created_at, closed_at and updated_at are never client-writable on update.
grant insert (org_id, name, phone, email, suburb, service_type, est_value_cents, source,
              stage, assigned_to, notes)
  on public.leads to authenticated;
grant update (name, phone, email, suburb, service_type, est_value_cents, source, stage,
              assigned_to, notes, lost_reason)
  on public.leads to authenticated;
grant delete on public.leads to authenticated;

create policy leads_select on public.leads
  for select to authenticated
  using (public.is_member(org_id));
create policy leads_insert on public.leads
  for insert to authenticated
  with check (public.is_member(org_id) and stage = 'new');
create policy leads_update on public.leads
  for update to authenticated
  using (public.is_member(org_id))
  with check (public.is_member(org_id));
-- Hard deletion (POPIA erasure requests) is an admin action and removes the lead's history too.
create policy leads_delete on public.leads
  for delete to authenticated
  using (public.has_role(org_id, 'admin'));

create policy lead_events_select on public.lead_events
  for select to authenticated
  using (public.is_member(org_id));
