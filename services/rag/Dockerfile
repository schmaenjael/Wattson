# syntax=docker/dockerfile:1

# ── Builder: install deps into a venv + bake the embedding model ─────────────
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_INPUT=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    SENTENCE_TRANSFORMERS_HOME=/opt/st-cache

RUN python -m venv "$VIRTUAL_ENV"

COPY services/rag/requirements.txt .

# BuildKit cache mount keeps the wheel cache on the host builder, so changing
# requirements re-resolves but never re-downloads unchanged wheels (torch alone
# is ~180 MB on the CPU index). Only /opt/venv + /opt/st-cache are copied
# forward, so neither the pip cache nor build cruft lands in the final image.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Bake embedding model weights at build time — offline operation, reproducible runtime.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# ── Runtime: slim image carrying only the venv, model cache + app ────────────
FROM python:3.12-slim

ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    SENTENCE_TRANSFORMERS_HOME=/opt/st-cache

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/st-cache /opt/st-cache
COPY services/rag/app/ .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
