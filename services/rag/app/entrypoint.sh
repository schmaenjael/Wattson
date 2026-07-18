#!/bin/bash
set -e

echo "==> Downloading knowledge files..."
python main.py --download

echo "==> Running ingestion pipeline..."
python main.py --ingest

echo "==> Starting RAG server..."
exec python main.py --serve
