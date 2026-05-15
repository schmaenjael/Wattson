#!/bin/sh
set -e

echo "==> Setting up users and permissions..."
envsubst < /tmp/scripts/init-db.template.sql | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "==> Applying schema migrations..."
for f in /tmp/scripts/migrations/*.sql; do
  echo "    → $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "==> Running seed files..."
for f in /tmp/scripts/db/*.sql; do
  echo "    → $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "==> Database initialization complete."
