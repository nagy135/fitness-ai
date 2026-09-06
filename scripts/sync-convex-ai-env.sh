#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-.env.local}"

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
  echo "CONVEX_SELF_HOSTED_URL is missing from $env_file" >&2
  exit 1
fi

if [[ -z "$admin_key" ]]; then
  admin_key="$(docker compose -f infra/docker-compose.yml exec -T backend ./generate_admin_key.sh | tail -n 1)"
fi

# A Convex cloud/local selector conflicts with the explicit self-hosted URL and
# admin key, even when its value is empty.
unset CONVEX_DEPLOYMENT

for name in AI_PROVIDER AI_MODEL OPENROUTER_API_KEY; do
  value="$(read_env_value "$name" || true)"
  if [[ -z "$value" ]]; then
    echo "$name is missing or empty in $env_file" >&2
    exit 1
  fi

  CONVEX_SELF_HOSTED_URL="$self_hosted_url" \
    CONVEX_SELF_HOSTED_ADMIN_KEY="$admin_key" \
    pnpm convex env set "$name" "$value"
done

echo "Synced AI_PROVIDER, AI_MODEL, and OPENROUTER_API_KEY to self-hosted Convex."
