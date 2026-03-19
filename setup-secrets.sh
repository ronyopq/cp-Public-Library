#!/bin/bash
set -euo pipefail

REPO="${1:-owner/repo}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it from https://cli.github.com" >&2
  exit 1
fi

if [ -z "$API_TOKEN" ]; then
  read -r -p "Enter CLOUDFLARE_API_TOKEN: " API_TOKEN
fi

if [ -z "$ACCOUNT_ID" ]; then
  read -r -p "Enter CLOUDFLARE_ACCOUNT_ID: " ACCOUNT_ID
fi

if [ -z "$API_TOKEN" ] || [ -z "$ACCOUNT_ID" ]; then
  echo "Both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required." >&2
  exit 1
fi

printf '%s' "$API_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN -R "$REPO"
printf '%s' "$ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID -R "$REPO"

echo "GitHub Actions secrets updated for $REPO"
