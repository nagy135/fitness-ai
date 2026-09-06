#!/usr/bin/env bash
set -euo pipefail

secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"

case "${1:-}" in
  --set-convex)
    pnpm convex env set BETTER_AUTH_SECRET "$secret"
    echo "BETTER_AUTH_SECRET was set in the active Convex deployment."
    ;;
  --help|-h)
    echo "Usage:"
    echo "  generate-better-auth-secret.sh              Print a new secret"
    echo "  generate-better-auth-secret.sh --set-convex Generate and set it in Convex"
    ;;
  "")
    printf '%s\n' "$secret"
    ;;
  *)
    echo "Unknown option: $1" >&2
    exit 2
    ;;
esac
