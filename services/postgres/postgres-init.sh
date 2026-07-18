#!/bin/sh
set -e

echo "==> Setting up users and permissions..."
envsubst < /tmp/scripts/postgres-init.template.sql | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "==> Applying schema migrations..."
for f in /tmp/scripts/migrations/*.sql; do
  echo "    → $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "==> Applying post-migration grants..."
# Grants live with the rest of the role/permission setup (this script + the init
# template), NOT in drizzle — drizzle owns table/schema DDL only. These run here,
# after migrations, because the `ml` schema/tables are created by those migrations.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
GRANT USAGE ON SCHEMA ml TO "${ML_DB_USER}";
GRANT SELECT ON ALL TABLES IN SCHEMA ml TO "${ML_DB_USER}";
ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA ml
  GRANT SELECT ON TABLES TO "${ML_DB_USER}";
SQL

echo "==> Database initialization complete."
