#!/bin/sh
set -e

echo "Starting database initialization with environment substitution..."
envsubst < /tmp/scripts/init-db.template.sql | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "Database initialization complete."
