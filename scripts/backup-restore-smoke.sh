#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pg_dump "$DATABASE_URL" --format=custom --file="$TMP/skillpilot.dump"
BASE="${DATABASE_URL%/*}"
TEST_DB="skillpilot_restore_smoke_$(date +%s)"
ADMIN_URL="$BASE/postgres"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "create database $TEST_DB"
RESTORE_URL="$BASE/$TEST_DB"
pg_restore --exit-on-error --dbname="$RESTORE_URL" "$TMP/skillpilot.dump"
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -c "select count(*) from users" >/dev/null
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database $TEST_DB"
echo 'backup/restore smoke: PASS'
