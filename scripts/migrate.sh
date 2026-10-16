#!/bin/sh
# Applies db/migrations/*.sql in order, once each, each inside its own transaction together with
# its schema_migrations row. Used by the one-shot `migrate` service in docker-compose.full.yml.
set -eu
export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-skillpilot}" PGDATABASE="${PGDATABASE:-skillpilot}"
DIR="${MIGRATIONS_DIR:-/migrations}"

psql -v ON_ERROR_STOP=1 -q <<'SQL'
create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now());
SQL

for f in "$DIR"/*.sql; do
  version=$(basename "$f" | sed -E 's/^([0-9]+).*/\1/')
  seen=$(psql -v ON_ERROR_STOP=1 -v v="$version" -tA <<'SQL'
select 1 from schema_migrations where version = :'v'
SQL
)
  if [ "$seen" = "1" ]; then continue; fi
  echo "applying $f"
  printf "insert into schema_migrations(version) values (:'v');\n" > /tmp/record.sql
  psql -1 -v ON_ERROR_STOP=1 -v v="$version" -f "$f" -f /tmp/record.sql
done
echo "SkillPilot migrations complete"

# Create a least-privilege application role. The migration/DB owner remains separate.
if [ -n "${SKILLPILOT_DB_APP_PASSWORD:-}" ]; then
  psql -v ON_ERROR_STOP=1 -v app_password="$SKILLPILOT_DB_APP_PASSWORD" <<'SQL'
SELECT format($fmt$DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='skillpilot_app') THEN
    CREATE ROLE skillpilot_app LOGIN PASSWORD %L;
  ELSE
    ALTER ROLE skillpilot_app LOGIN PASSWORD %L;
  END IF;
END
$do$;$fmt$, :'app_password', :'app_password') \gexec
GRANT CONNECT ON DATABASE skillpilot TO skillpilot_app;
GRANT USAGE ON SCHEMA public TO skillpilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO skillpilot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO skillpilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO skillpilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO skillpilot_app;
REVOKE UPDATE, DELETE ON user_skill_evidence, mentor_reviews FROM skillpilot_app;
GRANT EXECUTE ON FUNCTION skillpilot_delete_account(uuid) TO skillpilot_app;
SQL
fi
