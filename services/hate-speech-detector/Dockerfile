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

FROM python:3.12-slim

WORKDIR /app

COPY services/hate-speech-detector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/.cache/huggingface

COPY services/hate-speech-detector/app/app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
