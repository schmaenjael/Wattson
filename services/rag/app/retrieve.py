"""
Retrieval + generation pipeline.

POST /query  {"question": "..."}  →  {"answer": "...", "sources": [...], "chunks_used": N}

Embeds the question, finds similar chunks via cosine distance, filters by
SIMILARITY_THRESHOLD, builds the system prompt from /config/knowledge/system-prompt.txt,
and calls the Ollama API for grounded generation.
"""

import os
from pathlib import Path

import httpx
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

MODEL_ID = "all-MiniLM-L6-v2"
SYSTEM_PROMPT_PATH = Path("/config/knowledge/system-prompt.txt")
TOP_K = 5
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.7"))
OLLAMA_TIMEOUT_S = 60.0

_model: SentenceTransformer | None = None
_system_prompt_template: str = ""


def load(model: SentenceTransformer) -> None:
    global _model, _system_prompt_template
    _model = model
    if SYSTEM_PROMPT_PATH.exists():
        _system_prompt_template = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    else:
        _system_prompt_template = (
            "Answer ONLY using the context below. "
            "If not present, say so.\n\n--- CONTEXT ---\n{context}"
        )


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


def _retrieve(question: str) -> list[dict]:
    assert _model is not None
    embedding = _model.encode([question])[0].tolist()

    conn = _db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT chunk_text, source_file, (embedding <=> %s::vector) AS dist
        FROM rag_data.chunks
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (embedding, embedding, TOP_K),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {"chunk_text": row[0], "source_file": row[1], "dist": float(row[2])}
        for row in rows
        if float(row[2]) <= SIMILARITY_THRESHOLD
    ]


def _call_ollama(system_prompt: str, question: str) -> str | None:
    endpoint = os.environ.get("OLLAMA_ENDPOINT", "http://ollama:11434")
    model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
    url = endpoint.rstrip("/") + "/api/chat"

    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
    }

    try:
        response = httpx.post(url, json=payload, timeout=OLLAMA_TIMEOUT_S)
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "").strip() or None
    except Exception as exc:
        print(f"Ollama call failed: {exc}")
        return None


def query(question: str) -> dict:
    chunks = _retrieve(question)

    if not chunks:
        return {
            "answer": "No relevant context found in the knowledge base.",
            "sources": [],
            "chunks_used": 0,
        }

    context = "\n\n---\n\n".join(c["chunk_text"] for c in chunks)
    system_prompt = _system_prompt_template.replace("{context}", context)
    sources = sorted({c["source_file"] for c in chunks})

    answer = _call_ollama(system_prompt, question)
    if answer is None:
        return {
            "answer": "RAG retrieval succeeded but Ollama is unavailable.",
            "sources": sources,
            "chunks_used": len(chunks),
        }

    return {
        "answer": answer,
        "sources": sources,
        "chunks_used": len(chunks),
    }
