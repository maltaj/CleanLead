# CleanLead

Lead and follow-up tracking for cleaning businesses. Next.js (App Router) + Supabase (Postgres, Auth).

## Quick start (local)

Requirements: Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npm run db:start                 # starts local Supabase, applies supabase/migrations
npx supabase status              # copy the API URL and publishable key
cp .env.local.example .env.local # then paste the publishable key
npm run dev                      # http://localhost:3000
```

Auth emails (signup confirmation, password reset) are caught by the local inbox at
http://127.0.0.1:54324. Email confirmation is on locally to match production.

## Scripts

| Script                                           | Purpose                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `npm run check`                                  | lint, typecheck, format check, unit tests (run before pushing)   |
| `npm run test:db`                                | pgTAP tenant isolation and RLS coverage tests (needs `db:start`) |
| `npm run db:reset`                               | rebuild the local database from migrations                       |
| `npm run db:diff -- <name>`                      | write a new migration from local schema changes                  |
| `npm run db:types`                               | regenerate TypeScript types from the local schema                |
| `npm run db:push:staging` / `db:push:production` | apply migrations to hosted projects                              |

## Environments

|           | Local            | Staging            | Production         |
| --------- | ---------------- | ------------------ | ------------------ |
| `APP_ENV` | `local`          | `staging`          | `production`       |
| Supabase  | `supabase start` | own hosted project | own hosted project |
| Config    | `.env.local`     | host env settings  | host env settings  |

Use three separate Supabase projects (staging and production are never shared). `src/lib/env.ts`
validates configuration at startup and refuses localhost or non-https URLs outside `local`.
Auth settings for hosted projects (site URL, redirect URLs, password rules, email confirmation) are
set in the Supabase dashboard or with `supabase config push`; `supabase/config.toml` is the reference.

## Tenancy and security model

- Tenant data lives in tables with an `org_id`. RLS is enabled and forced on every `public` table.
- Access is decided by `is_member(org_id)` / `has_role(org_id, role)`, which read the `memberships`
  table for `auth.uid()`. A client-supplied organisation ID is never trusted on its own.
- Organisations are created only through the `create_organisation()` function (one transaction:
  organisation, owner membership, audit event). Clients have no insert or delete rights on them.
- Owner changes are owner-only and the last owner cannot be removed (trigger).
- `supabase/tests/database/01_rls_coverage.test.sql` fails if any table lacks RLS or a
  membership-based policy, so new tables must be secured before CI passes.
- `02_tenant_isolation.test.sql` attempts cross-tenant reads and writes by guessing UUIDs.
- `03_leads.test.sql` covers leads: isolation, the event trail, outcome dates, reopening, and
  append-only history.

## Leads

Stages are New, Contacted, Quote sent, Won and Lost. Follow-ups are a separate entity (next milestone),
so "follow-up due" is never a stage. The database owns the rules: `closed_at` is set on Won/Lost and
cleared on reopen, every creation and stage change writes an immutable `lead_events` row, and a
reopen keeps the earlier outcome in history. Assignees must belong to the organisation.

When you add a tenant table: add `org_id uuid not null references organisations`, enable and force
RLS, write policies using `is_member` / `has_role`, and extend the isolation test.

## Deploying migrations

Run the "Apply database migrations" workflow (manual) or `npm run db:push:<env>` with
`SUPABASE_ACCESS_TOKEN` and the project ref variables set. Production requires `CONFIRM_PRODUCTION=yes`.
