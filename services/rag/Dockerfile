FROM python:3.12-slim

WORKDIR /app

COPY services/rag/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake embedding model weights at build time — offline operation, reproducible builds.
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence-transformers
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY services/rag/app/ .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
