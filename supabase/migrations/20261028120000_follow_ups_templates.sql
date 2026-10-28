-- CleanLead: follow-ups and message templates.
-- A follow-up always has a due date and an explicit status. Completing one records the outcome and
-- can schedule the next action in the same transaction. A closed lead never keeps open follow-ups,
-- so lead stage and follow-up state cannot silently contradict each other.

create type public.follow_up_status as enum ('open', 'done', 'skipped');

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  due_at timestamptz not null,
  status public.follow_up_status not null default 'open',
  note text check (note is null or char_length(note) <= 300),
  outcome text check (outcome is null or char_length(outcome) <= 500),
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  constraint follow_ups_completed_matches_status check ((status = 'open') = (completed_at is null)),
  constraint follow_ups_done_needs_outcome
    check (status <> 'done' or (outcome is not null and btrim(outcome) <> ''))
);

create index follow_ups_org_status_due_idx on public.follow_ups (org_id, status, due_at);
create index follow_ups_lead_idx on public.follow_ups (lead_id, created_at desc);
create index follow_ups_assigned_idx on public.follow_ups (assigned_to) where assigned_to is not null;

-- Lead history gains follow-up entries.
alter table public.lead_events drop constraint lead_events_type_check;
alter table public.lead_events add constraint lead_events_type_check
  check (type in ('created', 'stage_changed', 'reopened', 'updated',
                  'follow_up_created', 'follow_up_done', 'follow_up_skipped'));

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------
create function public.follow_ups_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_org uuid;
  v_lead_stage public.lead_stage;
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    -- The lead must belong to the same organisation (blocks cross-tenant lead_id injection).
    select org_id, stage into v_lead_org, v_lead_stage from public.leads where id = new.lead_id;
    if v_lead_org is null or v_lead_org <> new.org_id then
      raise exception 'lead does not belong to this organisation' using errcode = '42501';
    end if;
    if v_lead_stage in ('won', 'lost') then
      raise exception 'cannot add a follow-up to a closed lead' using errcode = '23514';
    end if;
    if new.status <> 'open' then
      raise exception 'a new follow-up must be open' using errcode = '23514';
    end if;
    new.completed_at := null;
    new.completed_by := null;
    new.outcome := null;
  else
    if new.org_id is distinct from old.org_id or new.lead_id is distinct from old.lead_id then
      raise exception 'org_id and lead_id cannot be changed' using errcode = '42501';
    end if;
    -- Completed or skipped follow-ups are history: they can no longer be edited.
    if old.status <> 'open' then
      raise exception 'this follow-up is already closed' using errcode = '23514';
    end if;
    if new.status <> 'open' then
      new.completed_at := now();
      new.completed_by := v_actor;
    end if;
  end if;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    if not exists (
      select 1 from public.memberships where org_id = new.org_id and user_id = new.assigned_to
    ) then
      raise exception 'assignee must be a member of the organisation' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger follow_ups_before_write
  before insert or update on public.follow_ups
  for each row execute function public.follow_ups_before_write();

-- History entries on the lead.
create function public.follow_ups_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (org_id, lead_id, actor_id, type, meta)
    values (new.org_id, new.lead_id, v_actor, 'follow_up_created',
            jsonb_build_object('follow_up_id', new.id, 'due_at', new.due_at, 'note', new.note));
  elsif new.status is distinct from old.status then
    insert into public.lead_events (org_id, lead_id, actor_id, type, meta)
    values (new.org_id, new.lead_id, v_actor,
            case new.status when 'done' then 'follow_up_done' else 'follow_up_skipped' end,
            jsonb_build_object('follow_up_id', new.id, 'outcome', new.outcome));
  end if;
  return new;
end;
$$;

create trigger follow_ups_after_write
  after insert or update on public.follow_ups
  for each row execute function public.follow_ups_after_write();

-- Closing a lead (won or lost) skips whatever is still open on it.
create function public.leads_close_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.follow_ups
     set status = 'skipped',
         outcome = 'Closed automatically: lead marked ' || new.stage::text
   where lead_id = new.id and status = 'open';
  return new;
end;
$$;

create trigger leads_close_follow_ups
  after update of stage on public.leads
  for each row
  when (new.stage in ('won', 'lost') and old.stage is distinct from new.stage)
  execute function public.leads_close_follow_ups();

revoke all on function public.follow_ups_before_write() from public, anon, authenticated;
revoke all on function public.follow_ups_after_write() from public, anon, authenticated;
revoke all on function public.leads_close_follow_ups() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Completing a follow-up: outcome required, optional next action, one transaction.
-- SECURITY INVOKER so row level security applies to the caller as usual.
-- ---------------------------------------------------------------------------
create function public.complete_follow_up(
  p_follow_up_id uuid,
  p_outcome text,
  p_next_due_at timestamptz default null,
  p_next_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fu public.follow_ups;
  v_next uuid;
begin
  if btrim(coalesce(p_outcome, '')) = '' then
    raise exception 'an outcome is required' using errcode = '22023';
  end if;

  update public.follow_ups
     set status = 'done', outcome = btrim(p_outcome)
   where id = p_follow_up_id and status = 'open'
   returning * into v_fu;

  if not found then
    raise exception 'follow-up not found or already closed' using errcode = 'P0002';
  end if;

  if p_next_due_at is not null then
    insert into public.follow_ups (org_id, lead_id, due_at, note, assigned_to)
    values (v_fu.org_id, v_fu.lead_id, p_next_due_at, nullif(btrim(coalesce(p_next_note, '')), ''), v_fu.assigned_to)
    returning id into v_next;
  end if;

  return v_next;
end;
$$;

revoke all on function public.complete_follow_up(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.complete_follow_up(uuid, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Message templates
-- ---------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_org_idx on public.templates (org_id, name);

create function public.templates_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.org_id is distinct from old.org_id then
      raise exception 'org_id cannot be changed' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger templates_before_write
  before insert or update on public.templates
  for each row execute function public.templates_before_write();
revoke all on function public.templates_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.follow_ups enable row level security;
alter table public.templates enable row level security;
alter table public.follow_ups force row level security;
alter table public.templates force row level security;

revoke all on public.follow_ups, public.templates from authenticated;
grant select on public.follow_ups, public.templates to authenticated;
grant insert (org_id, lead_id, due_at, note, assigned_to) on public.follow_ups to authenticated;
grant update (due_at, note, assigned_to, status, outcome) on public.follow_ups to authenticated;
grant delete on public.follow_ups to authenticated;
grant insert (org_id, name, body) on public.templates to authenticated;
grant update (name, body) on public.templates to authenticated;
grant delete on public.templates to authenticated;

create policy follow_ups_select on public.follow_ups
  for select to authenticated
  using (public.is_member(org_id));
create policy follow_ups_insert on public.follow_ups
  for insert to authenticated
  with check (public.is_member(org_id) and status = 'open');
create policy follow_ups_update on public.follow_ups
  for update to authenticated
  using (public.is_member(org_id))
  with check (public.is_member(org_id));
create policy follow_ups_delete on public.follow_ups
  for delete to authenticated
  using (public.has_role(org_id, 'admin'));

create policy templates_select on public.templates
  for select to authenticated
  using (public.is_member(org_id));
create policy templates_insert on public.templates
  for insert to authenticated
  with check (public.is_member(org_id));
create policy templates_update on public.templates
  for update to authenticated
  using (public.is_member(org_id))
  with check (public.is_member(org_id));
create policy templates_delete on public.templates
  for delete to authenticated
  using (public.has_role(org_id, 'admin'));
