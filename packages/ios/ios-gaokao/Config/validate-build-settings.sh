#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
require_team="${2:-}"

case "$environment" in
  staging)
    url="${AISTUDY_API_BASE_URL_STAGING:-}"
    ;;
  production)
    url="${AISTUDY_API_BASE_URL_PRODUCTION:-}"
    ;;
  *)
    echo "Usage: $0 <staging|production> [--require-team]" >&2
    exit 2
    ;;
esac

if [[ -z "$url" ]]; then
  echo "Missing API URL for ${environment}: set AISTUDY_API_BASE_URL_${environment^^}" >&2
  exit 1
fi

if [[ ! "$url" =~ ^https://[^[:space:]]+$ ]]; then
  echo "API URL must be an HTTPS URL without whitespace: ${environment}" >&2
  exit 1
fi

normalized_url="$(printf '%s' "$url" | tr '[:upper:]' '[:lower:]')"
for placeholder in 'example.com' 'xxx.vercel.app' '$('; do
  if [[ "$normalized_url" == *"$placeholder"* ]]; then
    echo "API URL is still a placeholder for ${environment}: ${url}" >&2
    exit 1
  fi
done

if [[ "$require_team" == "--require-team" ]]; then
  team="${AISTUDY_DEVELOPMENT_TEAM:-}"
  if [[ ! "$team" =~ ^[A-Za-z0-9]{10}$ ]]; then
    echo "AISTUDY_DEVELOPMENT_TEAM must be a 10-character Apple Team ID" >&2
    exit 1
  fi
fi

echo "iOS ${environment} build settings are valid"
