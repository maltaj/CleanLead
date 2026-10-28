#!/usr/bin/env bash
# Apply migrations to a hosted Supabase project.
# Usage: scripts/db-push.sh <staging|production>
# Requires: SUPABASE_ACCESS_TOKEN, and SUPABASE_STAGING_PROJECT_REF / SUPABASE_PRODUCTION_PROJECT_REF.
set -euo pipefail

target="${1:-}"
case "$target" in
  staging) ref="${SUPABASE_STAGING_PROJECT_REF:?set SUPABASE_STAGING_PROJECT_REF}" ;;
  production) ref="${SUPABASE_PRODUCTION_PROJECT_REF:?set SUPABASE_PRODUCTION_PROJECT_REF}" ;;
  *) echo "usage: $0 <staging|production>" >&2; exit 2 ;;
esac
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

npx supabase link --project-ref "$ref"
echo "Pending migrations for $target ($ref):"
npx supabase db push --dry-run

if [ "$target" = "production" ] && [ "${CONFIRM_PRODUCTION:-}" != "yes" ]; then
  echo "Refusing to push to production without CONFIRM_PRODUCTION=yes" >&2
  exit 1
fi
npx supabase db push
