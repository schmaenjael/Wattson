# T-10 · pgvector RAG — Implementation Proposal

## Origin

Upgrade path for the Ollama model grounding note in the original T-10. The simple
context-injection approach (prepend `/config/knowledge/` files as a system prompt) remains
valid for small knowledge bases. This proposal supersedes it with full vector retrieval.

---

## Security Configuration Plan

### Dedicated Database & Schema Isolation

- Create `ollama` — dedicated Postgres user for the Python RAG container. Never use
  the `postgres` superuser or the bot's `BOT_USERNAME` account.
- Create schema `rag_data` inside the existing database, isolated from the bot's `public`
  schema and all business tables.

### Restrictive Permission Model

```sql
-- Revoke all public schema defaults for the new user
REVOKE ALL ON SCHEMA public FROM ollama;

-- Database-level access
GRANT CONNECT ON DATABASE <db> TO ollama;

-- Schema-level access
GRANT USAGE ON SCHEMA rag_data TO ollama;

-- Table-level access (only on rag_data tables)
GRANT SELECT, INSERT, UPDATE ON rag_data.chunks TO ollama;
```

`ollama` has zero visibility into bot tables (`settings`, `bans`, `users`, etc.).

## Project Implementation Plan

### Phase 1: Database Provisioning & Security

**Task 1.1** — Enable pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Task 1.2** — Create user and schema in the same postgres-init.template.sql script and by using the same way of inserting a user:

The name

```sql
CREATE USER ollama WITH PASSWORD '<strong-password>';
CREATE SCHEMA rag_data;
```

**Task 1.3** — Apply permissions (see Security section above).

**Task 1.4** — Create vector table:

```sql
CREATE TABLE rag_data.chunks (
    id          BIGSERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    chunk_text  TEXT NOT NULL,
    content_hash CHAR(64) NOT NULL UNIQUE,  -- SHA-256; prevents duplicate ingestion
    embedding   vector(384) NOT NULL,        -- all-MiniLM-L6-v2 produces 384-dim vectors
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index: builds incrementally, no pre-training required (unlike IVFFlat)
CREATE INDEX ON rag_data.chunks USING hnsw (embedding vector_cosine_ops);
```

### Phase 2: Project Architecture & Environment Setup

**Task 2.1** — Source files live in `/config/knowledge/` (existing `config/` convention).
Mount as a Docker volume — **do not bake into the image**. Knowledge base updates must not require a full image rebuild.

**Task 2.2** — Environment variables in `.env`:

```
RAG_DB_HOST=postgres
RAG_DB_PORT=5432
RAG_DB_NAME=<db>
RAG_DB_USER=ollama
RAG_DB_PASSWORD=<password>
OLLAMA_ENDPOINT=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b
CHUNK_SIZE=500
CHUNK_OVERLAP=50
SIMILARITY_THRESHOLD=0.7
```

### Phase 3: Python Application (Direct Stack — No LangChain/LlamaIndex)

**Do not use LangChain or LlamaIndex.** They add 300–500 MB of dependencies for a pipeline
that is ~150 lines of direct code. Use:

- `sentence-transformers` — embeddings
- `psycopg2` + `pgvector` — database
- `httpx` — Ollama API calls
- `hashlib` — chunk deduplication

**Task 3.1: Ingestion Pipeline (`--ingest`)**

1. Scan `/config/knowledge/` for `.md` and `.txt` files.
2. Split each file into overlapping chunks (500 tokens, 50 token overlap).
3. SHA-256 each chunk. Skip `INSERT` if hash already in table (`ON CONFLICT DO NOTHING`).
4. Batch-embed chunks using `all-MiniLM-L6-v2`.
5. Write `(source_file, chunk_text, content_hash, embedding)` rows.

**Task 3.2: Retrieval & Generation Pipeline (`--serve`)**

1. Embed user query with the same model.
2. Query cosine distance — reject chunks with distance > `SIMILARITY_THRESHOLD`:
   ```sql
   SELECT chunk_text, (embedding <=> $1) AS dist
   FROM rag_data.chunks
   ORDER BY embedding <=> $1
   LIMIT 5;
   -- Filter dist > SIMILARITY_THRESHOLD in application layer
   ```
3. If no chunks pass threshold, respond: "No relevant context found in knowledge base."
4. Construct a configurable system prompt that should be read from /config at startup:

a possible prompt example:

```
You are Wattson, a moderation assistant for a Volt Europa Discord server.
Answer ONLY using the context below. If the answer is not present, say so explicitly.

--- CONTEXT ---
{joined chunk_text values}
```

5. POST to Ollama `/api/chat` with system prompt + user query.
6. Expose via HTTP endpoint (e.g. FastAPI, port 8080) consumed by the bot's existing
   `src/core/providers/harm/` or a new `src/core/providers/rag/` provider.

### Phase 4: Containerization & Deployment

**Task 4.1** — Dockerfile (slim Python base):

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake embedding model weights at build time — ensures offline operation
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY app/ .
ENTRYPOINT ["/app/entrypoint.sh"]
```

**Task 4.2** — Mount knowledge base as a volume, not copied into image:

```yaml
volumes:
  - ./config/knowledge:/config/knowledge:ro
```

**Task 4.3** — `entrypoint.sh`:

```bash
#!/bin/bash
set -e
python main.py --ingest    # idempotent: skips existing chunks via content_hash UNIQUE
python main.py --serve     # starts HTTP server
```

**Task 4.4** — Verify:

- Container starts, ingestion logs `N chunks inserted, M skipped (already present)`.
- Query covered by knowledge base → grounded answer.
- Query not in knowledge base → "No relevant context found."
- Restart container → zero duplicate rows in `rag_data.chunks`.

Add to `docker-compose.yml` under `production` profile:

```yaml
rag:
  profiles: ['production', 'development']
  build:
    context: services/rag
  container_name: rag
  environment:
    - RAG_DB_HOST=postgres
    - RAG_DB_USER=${RAG_DB_USER:?err}
    - RAG_DB_PASSWORD=${RAG_DB_PASSWORD:?err}
    - RAG_DB_NAME=${POSTGRES_DB:?err}
    - OLLAMA_ENDPOINT=${OLLAMA_ENDPOINT:-http://ollama:11434}
    - OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.2:3b}
  volumes:
    - ./config/knowledge:/config/knowledge:ro
  ports:
    - '8080:8080'
  depends_on:
    postgres:
      condition: service_healthy
    ollama:
      condition: service_healthy
  networks:
    - wattson-net
```

---

## Performance Overview & Architecture Issues

### pgvector Performance Characteristics

| Dataset size      | Index             | Query latency | Notes                                   |
| ----------------- | ----------------- | ------------- | --------------------------------------- |
| < 10k chunks      | None (exact scan) | < 5 ms        | No index needed at this scale           |
| 10k – 500k chunks | HNSW              | 1–10 ms       | Recall ~98%, memory: ~1.6 bytes/dim/row |
| > 500k chunks     | HNSW (tuned)      | 5–50 ms       | Tune `m` and `ef_construction` params   |

For a single-guild bot's operator knowledge base (realistically: tens of files, hundreds to
low thousands of chunks), performance is a non-issue. Exact scan is fine; the HNSW index is
a forward-compatibility measure, not a current requirement.

Ingestion cost: `all-MiniLM-L6-v2` on CPU embeds ~2000 sequences/minute in batch mode.
1000 chunks ≈ 30 seconds. Idempotent re-runs after the first pass are near-instant.

### Architecture Issues

**1. Shared Postgres instance**
The RAG service shares the same Postgres instance as the bot. pgvector cosine similarity
queries use parallel workers and can briefly spike CPU and I/O. At this dataset size, impact
on bot queries is negligible. If the knowledge base grows to 100k+ chunks and query volume
increases, consider a read replica for the RAG service.

**2. No pgBouncer**
The Python RAG container adds a direct persistent Postgres connection. Combined with the
bot's Drizzle connection pool and pgAdmin, the connection count remains low. Document the
connection budget and add it to the Postgres `max_connections` review if other services are
added later.

**3. HNSW index memory**
HNSW index for `vector(384)` uses ~1.6 bytes/dim/row in memory during queries. 10k rows ≈
6 MB. Not a concern at this scale. At 1M rows: ~600 MB — revisit then.

**4. Model dimension lock-in**
`vector(384)` is hardcoded to `all-MiniLM-L6-v2`. Swapping to a different embedding model
(different dimensions) requires dropping and recreating the table plus re-ingesting all
chunks. Document the chosen model explicitly in the schema migration comment.

**5. Ollama 3B context vs chunk count**
`llama3.2:3b` has a 128k token context window. At 500 tokens/chunk, even 50 retrieved
chunks fit. The k=5 limit in the query is a quality constraint (more chunks = more noise),
not a context constraint. Keep k=3–5 and rely on the similarity threshold to reject
irrelevant results before they reach the model.

**6. Single-point ingestion sequencing**
The entrypoint runs ingest then serve. If ingestion fails mid-run (e.g. Postgres
temporarily unavailable), the serve step never starts. Add retry logic with exponential
backoff in the ingestion step, or make the serve step start independently and run ingestion
as a background task on startup.

### Important notice

Document the most important information in the ARCHITECHTURE.md file.
Also write an information in README.md whats necessary.
