#!/bin/sh
set -e

echo "==> Adding postgres as a server..."
# pgAdmin 9.x runs as the non-root `pgadmin` user, so /pgadmin4 (root-owned app dir)
# is not writable. Write the generated config to /tmp instead and point the
# entrypoint at it via PGADMIN_SERVER_JSON_FILE (set in docker-compose).
cat > /tmp/servers.json <<EOF
{
  "Servers": {
    "1": {
      "Name": "Wattson",
      "Group": "Servers",
      "Host": "postgres",
      "Port": 5432,
      "MaintenanceDB": "${POSTGRES_DB}",
      "Username": "${POSTGRES_USER}",
      "PassFile": "/tmp/pgpassfile",
      "SSLMode": "prefer"
    }
  }
}
EOF

echo "postgres:5432:*:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > /tmp/pgpassfile
chmod 600 /tmp/pgpassfile

exec /entrypoint.sh "$@"
