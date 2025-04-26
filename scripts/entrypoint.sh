#!/bin/sh
set -e

TEMPLATE_FILE="/tmp/init-db.template.js"
OUTPUT_FILE="/docker-entrypoint-initdb.d/init-db.js"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "[ERROR] Template file not found: $TEMPLATE_FILE"
  exit 1
fi

REQUIRED_VARS="MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD MONGO_USERNAME MONGO_PASSWORD MONGO_INITDB_DATABASE"

for var in $REQUIRED_VARS; do
  if [ -z "$(eval echo \$$var)" ]; then
    echo "[ERROR] Environment variable $var is not set."
    exit 1
  fi
done

envsubst < "$TEMPLATE_FILE" > "$OUTPUT_FILE"

exec docker-entrypoint.sh mongod
