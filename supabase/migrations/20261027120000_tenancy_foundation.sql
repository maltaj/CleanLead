-- CleanLead: tenancy foundation
-- Organisations, memberships, profiles, audit events, RLS helpers and policies.
-- Principle: the database is the tenant boundary. Membership is derived from the
-- memberships table via auth.uid(); no client-supplied organisation ID is trusted.

-- ---------------------------------------------------------------------------
-- Privileges: nothing is exposed to anon; authenticated gets only what policies allow.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Types and tables
-- ---------------------------------------------------------------------------
-- Declared lowest to highest so role comparisons work: member < admin < owner.
create type public.org_role as enum ('member', 'admin', 'owner');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  public_form_enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id),
  -- Lets the API embed the member's profile (name, email) when listing a team.
  constraint memberships_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade
);
create index memberships_user_id_idx on public.memberships (user_id);

-- Append-only record of security-relevant events. Written only by SECURITY DEFINER code.
create table public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_created_idx on public.audit_events (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies on memberships cannot recurse)
-- ---------------------------------------------------------------------------
create function public.is_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organisations o on o.id = m.org_id
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and o.deleted_at is null
  );
$$;

create function public.has_role(p_org_id uuid, p_min_role public.org_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organisations o on o.id = m.org_id
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role >= p_min_role
      and o.deleted_at is null
  );
$$;

create function public.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    join public.organisations o on o.id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
      and o.deleted_at is null
  );
$$;

revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.has_role(uuid, public.org_role) from public, anon;
revoke all on function public.shares_org_with(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.org_role) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles are created from auth.users
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership integrity: owner-only owner changes, and never orphan an organisation
-- ---------------------------------------------------------------------------
create function public.enforce_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_is_owner boolean;
  v_org_exists boolean;
  v_other_owners int;
  v_touches_owner boolean;
  v_loses_owner boolean;
begin
  -- Trusted server-side code (migrations, service role) has no auth.uid() and is not restricted.
  if v_actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_touches_owner := old.role = 'owner';
    v_loses_owner := old.role = 'owner';
  else
    v_touches_owner := old.role = 'owner' or new.role = 'owner';
    v_loses_owner := old.role = 'owner' and new.role <> 'owner';
  end if;

  -- Only owners may grant, change or remove the owner role.
  if v_touches_owner then
    select exists (
      select 1 from public.memberships
      where org_id = old.org_id and user_id = v_actor and role = 'owner'
    ) into v_actor_is_owner;
    if not v_actor_is_owner then
      raise exception 'only an owner can change owner memberships' using errcode = '42501';
    end if;
  end if;

  -- An organisation must always keep at least one owner (unless it is being deleted).
  if v_loses_owner then
    select exists (select 1 from public.organisations where id = old.org_id) into v_org_exists;
    if v_org_exists then
      select count(*) into v_other_owners
      from public.memberships
      where org_id = old.org_id and role = 'owner' and user_id <> old.user_id;
      if v_other_owners = 0 then
        raise exception 'an organisation must keep at least one owner' using errcode = '23514';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger memberships_enforce_rules
  before update or delete on public.memberships
  for each row execute function public.enforce_membership_rules();

-- ---------------------------------------------------------------------------
-- Audit helper (not callable by clients)
-- ---------------------------------------------------------------------------
create function public.log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, meta)
  values (p_org_id, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;
-- Supabase default grants would otherwise let signed-in users forge audit entries.
revoke all on function public.log_audit_event(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

-- Audit events for membership changes made by end users.
create function public.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'DELETE' then
      perform public.log_audit_event(
        old.org_id, 'membership.removed', 'membership', old.user_id::text,
        jsonb_build_object('role', old.role)
      );
    elsif new.role is distinct from old.role then
      perform public.log_audit_event(
        new.org_id, 'membership.role_changed', 'membership', new.user_id::text,
        jsonb_build_object('from', old.role, 'to', new.role)
      );
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger memberships_audit
  after update or delete on public.memberships
  for each row execute function public.audit_membership_change();

-- Trigger functions are never callable directly by clients.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_membership_rules() from public, anon, authenticated;
revoke all on function public.audit_membership_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Organisation creation: one transaction creates the org, owner membership and audit entry.
-- ---------------------------------------------------------------------------
create function public.create_organisation(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_org uuid;
  v_attempt int := 0;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'organisation name must be 2 to 100 characters' using errcode = '22023';
  end if;
  -- Abuse guard: bound how many organisations one user can own.
  if (select count(*) from public.memberships where user_id = v_user and role = 'owner') >= 5 then
    raise exception 'organisation limit reached' using errcode = '54000';
  end if;

  v_base := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := left(v_base, 40);
  v_base := btrim(v_base, '-');
  if char_length(v_base) < 3 then
    v_base := 'business';
  end if;
  v_slug := v_base;

  loop
    begin
      insert into public.organisations (name, slug, created_by)
      values (v_name, v_slug, v_user)
      returning id into v_org;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 8 then
        raise exception 'could not allocate a unique slug' using errcode = '23505';
      end if;
      v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
    end;
  end loop;

  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'owner');
  perform public.log_audit_event(v_org, 'organisation.created', 'organisation', v_org::text,
                                 jsonb_build_object('slug', v_slug));
  return v_org;
end;
$$;

revoke all on function public.create_organisation(text) from public, anon;
grant execute on function public.create_organisation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_events enable row level security;

alter table public.profiles force row level security;
alter table public.organisations force row level security;
alter table public.memberships force row level security;
alter table public.audit_events force row level security;

-- Column-level grants: clients can only touch what they are meant to.
revoke all on public.profiles, public.organisations, public.memberships, public.audit_events
  from authenticated;
grant select on public.profiles, public.organisations, public.memberships, public.audit_events
  to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, public_form_enabled) on public.organisations to authenticated;
grant update (role) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

-- profiles: your own, plus people who share an organisation with you.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organisations: members read; admins update. Creation only through create_organisation().
create policy organisations_select on public.organisations
  for select to authenticated
  using (public.is_member(id));
create policy organisations_update on public.organisations
  for update to authenticated
  using (public.has_role(id, 'admin'))
  with check (public.has_role(id, 'admin'));

-- memberships: members read the roster; admins change roles/remove; anyone can leave.
-- No insert policy: members are added only by trusted server code (invitations, later).
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_member(org_id));
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.has_role(org_id, 'admin'))
  with check (public.has_role(org_id, 'admin'));
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.has_role(org_id, 'admin') or user_id = (select auth.uid()));

-- audit_events: admins read; nobody writes directly.
create policy audit_events_select on public.audit_events
  for select to authenticated
  using (public.has_role(org_id, 'admin'));
