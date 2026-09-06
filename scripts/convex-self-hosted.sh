#!/usr/bin/env bash
set -euo pipefail

env_file="${CONVEX_ENV_FILE:-.env.local}"

if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

read_env_value() {
  local name="$1"
  local line=''
  local value=''

  while IFS= read -r line; do
    case "$line" in
      "$name="*)
        value="${line#*=}"
        value="${value%$'\r'}"
        if [[ "$value" == \"*\" && "$value" == *\" ]]; then
          value="${value:1:${#value}-2}"
        elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
          value="${value:1:${#value}-2}"
        fi
        printf '%s' "$value"
        return 0
        ;;
    esac
  done < "$env_file"

  return 1
}

self_hosted_url="$(read_env_value CONVEX_SELF_HOSTED_URL || true)"
admin_key="$(read_env_value CONVEX_SELF_HOSTED_ADMIN_KEY || true)"

if [[ -z "$self_hosted_url" ]]; then
  echo "CONVEX_SELF_HOSTED_URL must be set in $env_file" >&2
  exit 1
fi

if [[ -z "$admin_key" ]]; then
  admin_key="$(docker compose -f infra/docker-compose.yml exec -T backend ./generate_admin_key.sh | tail -n 1)"
fi

unset CONVEX_DEPLOYMENT
export CONVEX_SELF_HOSTED_URL="$self_hosted_url"
export CONVEX_SELF_HOSTED_ADMIN_KEY="$admin_key"

exec pnpm convex "$@"
