ARG PG_MAJOR=17
FROM pgvector/pgvector:pg${PG_MAJOR}

RUN apt-get update \
    && apt-get install -y --no-install-recommends gettext-base dos2unix \
    && rm -rf /var/lib/apt/lists/*

COPY ./services/postgres/postgres-init.template.sql /tmp/scripts/postgres-init.template.sql
COPY ./services/postgres/postgres-init.sh /docker-entrypoint-initdb.d/postgres-init.sh
COPY ./scripts/migrations /tmp/scripts/migrations
COPY ./services/postgres/seed /tmp/scripts/seed

RUN dos2unix /docker-entrypoint-initdb.d/postgres-init.sh \
    && chmod +x /docker-entrypoint-initdb.d/postgres-init.sh
