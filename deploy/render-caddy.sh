#!/usr/bin/env bash
# Renders deploy/caddy/render/Caddyfile from the DOMAIN MANIFESTS + the
# already-deployed per-domain site files. No numbered env slots — routing is
# derived from src/domains/<key>/domain.config.ts.
#
# Deployment state = one site file per deployed domain under
# deploy/caddy/render/sites/. Writing a domain's file never touches another
# domain's (deploy-preservation guarantee).
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

out="$ROOT/deploy/caddy/render/Caddyfile"
mkdir -p "$ROOT/deploy/caddy/render/sites"
if [[ -d "$out" ]]; then rm -rf "$out"; fi

node "$ROOT/scripts/platform.mjs" caddy render --env-file "$ENV_FILE" --out "$out"
sites="$(grep -c 'import app-site' "$out" || true)"
echo "Rendered $out — $sites active site block(s)."
