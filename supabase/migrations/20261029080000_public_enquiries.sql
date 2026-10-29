-- CleanLead: public enquiry form.
-- Anonymous visitors never touch tables. The Next.js server calls these functions with the
-- service role only; anon and authenticated have no EXECUTE and no table access.

alter table public.leads
  add column consent_at timestamptz,
  add column enquiry_message text check (enquiry_message is null or char_length(enquiry_message) <= 1000);
-- Neither column is in the authenticated insert/update column grants, so clients cannot set them.

-- Abuse bookkeeping: hashed IPs only (no raw addresses), pruned after 7 days by the retention job.
create table public.public_enquiry_attempts (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) between 16 and 128),
  created_at timestamptz not null default now()
);
create index public_enquiry_attempts_ip_idx on public.public_enquiry_attempts (org_id, ip_hash, created_at desc);
create index public_enquiry_attempts_org_idx on public.public_enquiry_attempts (org_id, created_at desc);

alter table public.public_enquiry_attempts enable row level security;
alter table public.public_enquiry_attempts force row level security;
revoke all on public.public_enquiry_attempts from anon, authenticated;
-- No policies: nobody but the definer functions (and service role) can see this table.

-- Public form details for rendering (name only; nothing else leaks).
create function public.public_form_info(p_slug text)
returns table (org_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select o.name
  from public.organisations o
  where o.slug = p_slug and o.public_form_enabled and o.deleted_at is null;
$$;

-- Returns 'ok', 'not_found' (unknown, disabled or deleted org) or 'rate_limited'.
create function public.submit_public_enquiry(
  p_slug text,
  p_name text,
  p_phone text,
  p_email text,
  p_suburb text,
  p_service_type text,
  p_message text,
  p_ip_hash text,
  p_consent boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select id into v_org
  from public.organisations
  where slug = p_slug and public_form_enabled and deleted_at is null;
  if v_org is null then
    return 'not_found';
  end if;

  if p_consent is not true then
    raise exception 'consent is required' using errcode = '22023';
  end if;
  if p_ip_hash is null or char_length(p_ip_hash) < 16 then
    raise exception 'ip hash required' using errcode = '22023';
  end if;

  -- Serialise per organisation so concurrent bursts cannot slip past the counters.
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));

  if (select count(*) from public.public_enquiry_attempts
       where org_id = v_org and ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.public_enquiry_attempts
          where org_id = v_org and created_at > now() - interval '1 hour') >= 100 then
    return 'rate_limited';
  end if;

  insert into public.public_enquiry_attempts (org_id, ip_hash) values (v_org, p_ip_hash);

  -- Table constraints (name length, contact required, lengths) are the final validation.
  insert into public.leads (org_id, name, phone, email, suburb, service_type, source,
                            notes, enquiry_message, consent_at)
  values (v_org, v_name, v_phone, v_email,
          nullif(btrim(coalesce(p_suburb, '')), ''),
          coalesce(nullif(btrim(coalesce(p_service_type, '')), ''), 'General cleaning'),
          'website_form',
          null,
          nullif(btrim(coalesce(p_message, '')), ''),
          now());
  return 'ok';
end;
$$;

revoke all on function public.public_form_info(text) from public, anon, authenticated;
revoke all on function public.submit_public_enquiry(text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.public_form_info(text) to service_role;
grant execute on function public.submit_public_enquiry(text, text, text, text, text, text, text, text, boolean)
  to service_role;
