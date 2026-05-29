#!/bin/sh
set -e

echo "==> Adding postgres as a server..."
cat > /pgadmin4/servers.json <<EOF
{
  "Servers": {
    "1": {
      "Name": "Wattson",
      "Group": "Servers",
      "Host": "postgres",
      "Port": 5432,
      "MaintenanceDB": "${POSTGRES_DB}",
      "Username": "${POSTGRES_USER}",
      "PassFile": "/pgpassfile",
      "SSLMode": "prefer"
    }
  }
}
EOF

echo "postgres:5432:*:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > /pgpassfile
chmod 600 /pgpassfile

exec /entrypoint.sh "$@"
