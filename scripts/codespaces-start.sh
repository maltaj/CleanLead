#!/usr/bin/env bash
# Starts the local Supabase stack inside a GitHub Codespace and writes .env.local.
# Codespace-only: it relaxes email confirmation in a local copy of supabase/config.toml
# (marked skip-worktree so it can't be committed by accident).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Waiting for Docker..."
for _ in $(seq 1 60); do
  docker info >/dev/null 2>&1 && break
  sleep 2
done
docker info >/dev/null 2>&1 || { echo "Docker did not start" >&2; exit 1; }

# Email links in a codespace point at 127.0.0.1 (the codespace itself), which a browser cannot
# open, so confirmation is switched off here. Production and CI keep it on.
sed -i '/^\[auth\.email\]/,/^\[/ s/^enable_confirmations = true/enable_confirmations = false/' supabase/config.toml
git update-index --skip-worktree supabase/config.toml

npm run db:start:lite

status="$(npx supabase status -o env 2>/dev/null)"
pick() { printf '%s\n' "$status" | sed -n "s/^$1=\"\(.*\)\"$/\1/p" | head -n1; }
api_url="$(pick API_URL)"
key="$(pick PUBLISHABLE_KEY)"
service_key="$(pick SERVICE_ROLE_KEY)"
[ -n "$service_key" ] || service_key="$(pick SECRET_KEY)"
[ -n "$key" ] || key="$(pick ANON_KEY)"
if [ -z "$api_url" ] || [ -z "$key" ]; then
  echo "Could not read the API URL or key from 'npx supabase status'. Create .env.local by hand (see README)." >&2
  exit 1
fi

site="http://localhost:3000"
if [ -n "${CODESPACE_NAME:-}" ]; then
  site="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi

cat > .env.local <<ENV
APP_ENV=local
NEXT_PUBLIC_SITE_URL=${site}
NEXT_PUBLIC_SUPABASE_URL=${api_url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}
SUPABASE_SERVICE_ROLE_KEY=${service_key}
ENQUIRY_IP_HASH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
ENV

echo "Ready. Run: npm run dev   (then open the forwarded port 3000)"
