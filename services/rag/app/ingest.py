"""
Ingestion pipeline: scans /config/knowledge/, chunks files, embeds with
all-MiniLM-L6-v2, and upserts into rag_data.chunks via content_hash UNIQUE
(ON CONFLICT DO NOTHING — fully idempotent across restarts).
"""

import hashlib
import os
from pathlib import Path

import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

KNOWLEDGE_DIR = Path("/config/knowledge")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
# all-MiniLM-L6-v2 max seq length is 256 word-pieces; 1 token ≈ 4 chars
CHARS_PER_TOKEN = 4
CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN
OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN

MODEL_ID = "all-MiniLM-L6-v2"


def _chunk_text(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - OVERLAP_CHARS
    return chunks


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _db_conn() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(
        host=os.environ["RAG_DB_HOST"],
        port=int(os.getenv("RAG_DB_PORT", "5432")),
        dbname=os.environ["RAG_DB_NAME"],
        user=os.environ["RAG_DB_USER"],
        password=os.environ["RAG_DB_PASSWORD"],
    )
    register_vector(conn)
    return conn


def run() -> None:
    model = SentenceTransformer(MODEL_ID)
    conn = _db_conn()
    cur = conn.cursor()

    files = [
        p for p in KNOWLEDGE_DIR.rglob("*")
        if p.suffix in {".md", ".txt"} and p.name != "system-prompt.txt"
    ]

    if not files:
        print("No knowledge files found in", KNOWLEDGE_DIR)
        conn.close()
        return

    inserted = 0
    skipped = 0

    for file in files:
        text = file.read_text(encoding="utf-8", errors="ignore")
        chunks = _chunk_text(text)
        if not chunks:
            continue

        embeddings = model.encode(chunks, batch_size=32, show_progress_bar=False)

        for chunk, embedding in zip(chunks, embeddings):
            content_hash = _sha256(chunk)
            cur.execute(
                """
                INSERT INTO rag_data.chunks (source_file, chunk_text, content_hash, embedding)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (content_hash) DO NOTHING
                """,
                (str(file.relative_to(KNOWLEDGE_DIR)), chunk, content_hash, embedding.tolist()),
            )
            if cur.rowcount == 1:
                inserted += 1
            else:
                skipped += 1

        conn.commit()
        print(f"  {file.name}: {len(chunks)} chunks")

    print(f"==> Ingestion complete: {inserted} inserted, {skipped} skipped (already present)")
    cur.close()
    conn.close()
