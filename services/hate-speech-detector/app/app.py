"""
Hate Speech Detection Service

Wraps sadjava/multilingual-hate-speech-xlm-roberta (XLM-RoBERTa fine-tuned for
multilingual hate speech classification) as a FastAPI microservice.

Model reference:
  @misc{multilingual-hate-speech-xlm-roberta,
    author    = {sadjava},
    title     = {Multilingual Hate Speech Detector},
    year      = {2024},
    publisher = {Hugging Face},
    url       = {https://huggingface.co/sadjava/multilingual-hate-speech-xlm-roberta}
  }
"""

from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = "sadjava/multilingual-hate-speech-xlm-roberta"

CATEGORIES = [
    "Race",
    "Sexual Orientation",
    "Gender",
    "Physical Appearance",
    "Religion",
    "Class",
    "Disability",
    "Appropriate",
]

tokenizer = None
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
    model.eval()
    yield

app = FastAPI(title="Hate Speech Detector", lifespan=lifespan)

class DetectRequest(BaseModel):
    text: str

class DetectResponse(BaseModel):
    category: str
    confidence: float
    all_scores: dict[str, float]

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_ID}

@app.post("/detect", response_model=DetectResponse)
async def detect(request: DetectRequest):
    inputs = tokenizer(
        request.text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512,
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)

    predicted_idx = int(torch.argmax(probabilities, dim=-1).item())
    confidence = float(probabilities[0][predicted_idx].item())

    return DetectResponse(
        category=CATEGORIES[predicted_idx],
        confidence=confidence,
        all_scores={cat: float(probabilities[0][i].item()) for i, cat in enumerate(CATEGORIES)},
    )
