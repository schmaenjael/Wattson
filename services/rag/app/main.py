"""
Entry point. Usage:
  python main.py --ingest   Run the ingestion pipeline and exit.
  python main.py --serve    Start the FastAPI query server on port 8080.
"""

import sys

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

import ingest
import retrieve

MODEL_ID = "all-MiniLM-L6-v2"


# ── FastAPI app ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    model = SentenceTransformer(MODEL_ID)
    retrieve.load(model)
    yield


app = FastAPI(title="Wattson RAG", lifespan=lifespan)


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]
    chunks_used: int


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    result = retrieve.query(req.question)
    return QueryResponse(**result)


# ── CLI dispatch ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--ingest" in sys.argv:
        ingest.run()
    elif "--serve" in sys.argv:
        uvicorn.run("main:app", host="0.0.0.0", port=8080, workers=1)
    else:
        print("Usage: python main.py --ingest | --serve", file=sys.stderr)
        sys.exit(1)
