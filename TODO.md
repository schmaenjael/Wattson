# HSD Model Training TODO

## Goal

Train custom multi-label hate speech classifier to replace current single-category HSD API.

**Categories**: race, gender, sexualOrientation, religion, disability, harassment (+ appropriate = all zeros)

---

## 1. Collect & Prepare Data

- [ ] Download [Measuring Hate Speech (Berkeley)](https://huggingface.co/datasets/ucberkeley-dlab/measuring-hate-speech) — 135k entries, all 6 categories
- [ ] Download [HateXplain](https://huggingface.co/datasets/hatexplain) — 20k, race/religion/gender
- [ ] Download [Civil Comments / Jigsaw](https://www.kaggle.com/c/jigsaw-unintended-bias-in-toxicity-classification) — 1.8M, noisy, all subgroups
- [ ] Remap all dataset labels → {race, gender, sexualOrientation, religion, disability, harassment}
- [ ] Hand-label ~500 political-discourse edge cases (self-hosted [Label Studio](https://labelstud.io/))
  - Include: rebuttals of hate speech, policy debates about trans rights/religion/gender equality
  - These are the most critical anti-over-flagging examples
- [ ] Target: 10,000–25,000 total labeled examples, ~15% harmful (realistic server ratio)
- [ ] 80/20 train/val split, stratified per label

---

## 2. Train Model

### Base model

`facebook/roberta-hate-speech-dynabench-r4-target` (adversarially collected, robust to creative phrasing)
→ Replace classification head with 6-output sigmoid layer
→ Fine-tune on combined dataset

### Input format (context-aware)

```
[CLS] [REPLY] {replied_to_message} [SEP] [CTX] {prev_msg_n-2} [SEP] {prev_msg_n-1} [SEP] [MSG] {current_message} [SEP]
```

- Max 512 tokens total — truncate context from left, never truncate the message
- Train with AND without context so model degrades gracefully when context unavailable

### Key hyperparameters

```python
learning_rate   = 2e-5
batch_size      = 16
epochs          = 4          # early stop on val macro-F1
weight_decay    = 0.01
warmup_ratio    = 0.1
max_length      = 512
# per-label sigmoid thresholds — tune after training
```

### Loss

```python
loss = F.binary_cross_entropy_with_logits(logits, labels, pos_weight=class_weights)
```

### Evaluation metric

Macro F1 (not accuracy — imbalanced classes). Track precision separately; high precision = low false-positive rate = less over-flagging.

---

## 3. Where to Train

**First run**: RunPod A100 40GB (~$1.49/hr) — ~2-3 hrs total = ~$3-5
**Iteration**: Home PC if NVIDIA RTX 3060+ (8GB+ VRAM)
**Avoid**: AMD GPU at home (ROCm + HuggingFace friction not worth it)

---

## 4. Serve New Model

- [ ] Build FastAPI endpoint (lives in `src/services/hsd/`) replacing current `/detect`

**New input**:

```json
{ "text": "...", "context": ["prev msg 1", "prev msg 2"], "reply_to": "..." }
```

**New output** (raw scores, not binary):

```json
{"scores": {"race": 0.92, "gender": 0.04, "harassment": 0.61, ...}, "detected": ["race", "harassment"]}
```

- [ ] Return raw float scores (0.0–1.0 per category) — let `hsd.ts` apply thresholds
- [ ] Serve with `transformers` pipeline or raw `model.forward()` in FastAPI handler

---

## 5. Integrate in Wattson

- [ ] Update `HsdApiResponse` in `src/core/providers/harm/hsd.ts` — new response shape returns per-category scores
- [ ] Update `detect(content)` → `detect(content, context?: ContextWindow)` in `HateSpeechDetector`
- [ ] Pass context from `runAutomod` in `src/core/providers/automod/run.ts`:
  - `message.reference` → replied-to message content
  - Last 3 messages in channel → preceding context
- [ ] Tune per-category confidence thresholds (starting points):
  - `race`, `disability`, `sexualOrientation`: flag ≥0.75 / action ≥0.90
  - `gender`, `religion`: flag ≥0.85 / action ≥0.92 (highest false-positive risk)
  - `harassment`: flag ≥0.70 / action ≥0.85

---

## 6. Validate

- [ ] Macro F1 per category on held-out 20% of training data
- [ ] Manual review: false-positive slice on political-discourse examples
- [ ] Shadow mode: run new model in parallel with old, log disagreements, no actions — validate for 1 week
- [ ] Promote to production, disable old model
