-- This file is used to initialize the database with the necessary users and permissions.

-- ── Bot user (full access to public schema) ──────────────────────────────────
CREATE USER "${BOT_USERNAME}" WITH PASSWORD '${BOT_PASSWORD}';
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${BOT_USERNAME}";
GRANT USAGE ON SCHEMA public TO "${BOT_USERNAME}";
GRANT CREATE ON SCHEMA public TO "${BOT_USERNAME}";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${BOT_USERNAME}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${BOT_USERNAME}";

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${BOT_USERNAME}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, UPDATE ON SEQUENCES  TO "${BOT_USERNAME}";

-- ── pgvector extension ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── RAG user (zero visibility into public/bot tables) ───────────────────────
CREATE USER "${RAG_DB_USER}" WITH PASSWORD '${RAG_DB_PASSWORD}';
REVOKE ALL ON SCHEMA public FROM "${RAG_DB_USER}";
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${RAG_DB_USER}";

-- ── rag_data schema: isolated from all bot tables ────────────────────────────
CREATE SCHEMA rag_data;
GRANT USAGE ON SCHEMA rag_data TO "${RAG_DB_USER}";

CREATE TABLE rag_data.chunks (
    id           BIGSERIAL PRIMARY KEY,
    source_file  TEXT        NOT NULL,
    chunk_text   TEXT        NOT NULL,
    content_hash CHAR(64)    NOT NULL UNIQUE,
    embedding    vector(384) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index: incremental build, no pre-training required (unlike IVFFlat)
CREATE INDEX ON rag_data.chunks USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE ON rag_data.chunks TO "${RAG_DB_USER}";
GRANT USAGE, SELECT ON SEQUENCE rag_data.chunks_id_seq TO "${RAG_DB_USER}";

-- ── ML training user (read-only on `ml` schema, zero visibility into public) ─
-- The `ml` schema and its tables are created by the drizzle migration, which runs
-- AFTER this template (see postgres-init.sh). So this file only creates the role
-- and locks it out of public; the schema-scoped SELECT grants run in the
-- post-migration step in postgres-init.sh, once `ml` actually exists.
CREATE USER "${ML_DB_USER}" WITH PASSWORD '${ML_DB_PASSWORD}';
REVOKE ALL ON SCHEMA public FROM "${ML_DB_USER}";
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${ML_DB_USER}";
