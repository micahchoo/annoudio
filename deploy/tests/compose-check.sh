#!/usr/bin/env sh
# Checks the production compose file for settings that a deployment cannot work without.
# Run from the repo root: sh deploy/tests/compose-check.sh
set -eu
cfg=$(env -u TZ POSTGRES_PASSWORD=x PAYLOAD_SECRET=x ANNOUDIO_ORIGIN=https://x SMTP_URL=smtp://x EMAIL_FROM=x \
  docker compose -f deploy/docker-compose.yml config)
fail=0
need() { if ! printf '%s' "$cfg" | grep -q -- "$1"; then echo "MISSING: $1"; fail=1; fi; }
need 'ANNOUDIO_MEDIA_CONSUMER: "1"'
need 'MEDIA_DIR: /media'
need 'name: annoudio'
# TZ on app and worker (two lines), UTC when .env has no TZ.
tz=$(printf '%s' "$cfg" | grep -c 'TZ: UTC' || true)
if [ "$tz" -ne 2 ]; then echo "MISSING: TZ on app and worker (found $tz)"; fail=1; fi
tzset=$(TZ=Asia/Kolkata POSTGRES_PASSWORD=x PAYLOAD_SECRET=x ANNOUDIO_ORIGIN=https://x SMTP_URL=smtp://x EMAIL_FROM=x \
  docker compose -f deploy/docker-compose.yml config | grep -c 'TZ: Asia/Kolkata' || true)
if [ "$tzset" -ne 2 ]; then echo "TZ from .env does not reach app and worker (found $tzset)"; fail=1; fi
[ "$fail" -eq 0 ] && echo "compose-check: ok"
exit $fail
