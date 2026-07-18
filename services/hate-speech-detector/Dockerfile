# syntax=docker/dockerfile:1
# Hate Speech Detection Service
#
# Builds a FastAPI microservice around sadjava/multilingual-hate-speech-xlm-roberta.
# Model weights are downloaded from Hugging Face on first container start and cached
# in a Docker named volume (hsd-model-cache) — no network access needed after that.
#
# Model reference:
#   @misc{multilingual-hate-speech-xlm-roberta,
#     author    = {sadjava},
#     title     = {Multilingual Hate Speech Detector},
#     year      = {2024},
#     publisher = {Hugging Face},
#     url       = {https://huggingface.co/sadjava/multilingual-hate-speech-xlm-roberta}
#   }

# ── Builder: resolve + install deps into an isolated venv ────────────────────
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_INPUT=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN python -m venv "$VIRTUAL_ENV"

COPY services/hate-speech-detector/requirements.txt .

# BuildKit cache mount keeps the wheel cache on the host builder, so changing
# requirements re-resolves but never re-downloads unchanged wheels. No
# --no-cache-dir here: only /opt/venv is copied forward, so the pip cache never
# lands in the final image.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ── Runtime: slim image carrying only the venv + app ─────────────────────────
FROM python:3.12-slim

ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY services/hate-speech-detector/app/app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
