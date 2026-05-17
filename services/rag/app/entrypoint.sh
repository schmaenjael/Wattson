#!/bin/bash
set -e

echo "==> Running ingestion pipeline..."
python main.py --ingest

echo "==> Starting RAG server..."
exec python main.py --serve
