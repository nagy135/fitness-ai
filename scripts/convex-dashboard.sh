#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${CONVEX_ENV_FILE:-$repo_root/.env.production.local}"
port="${DASHBOARD_PORT:-6792}"
image="${CONVEX_DASHBOARD_IMAGE:-ghcr.io/get-convex/convex-dashboard:latest}"

if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

# Read only the deployment URL; never execute the env file or pass its secrets
# to the dashboard container.
self_hosted_url=''
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    CONVEX_SELF_HOSTED_URL=*)
      self_hosted_url="${line#*=}"
      self_hosted_url="${self_hosted_url%$'\r'}"
      if [[ "$self_hosted_url" == \"*\" || "$self_hosted_url" == \'*\' ]]; then
        self_hosted_url="${self_hosted_url:1:${#self_hosted_url}-2}"
      fi
      break
      ;;
  esac
done < "$env_file"

if [[ ! "$self_hosted_url" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "Set CONVEX_SELF_HOSTED_URL to an HTTP(S) URL in $env_file" >&2
  exit 1
fi

if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then
  echo "DASHBOARD_PORT must be between 1 and 65535" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker must be installed and running." >&2
  exit 1
fi

printf 'Backend: %s\nDashboard: http://localhost:%s\n' "$self_hosted_url" "$port"
printf 'Log in with CONVEX_SELF_HOSTED_ADMIN_KEY from %s\n' "$env_file"
printf 'Edits affect this backend immediately. Press Ctrl+C to stop the dashboard.\n'

exec docker run --rm \
  -p "127.0.0.1:$port:6791" \
  -e "NEXT_PUBLIC_DEPLOYMENT_URL=$self_hosted_url" \
  "$image"
