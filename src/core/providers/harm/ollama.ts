import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { HarmCategory, HarmCategoryResult, HarmDetectionConfig, HarmDetectionResult } from './types';

const HARM_CATEGORIES: HarmCategory[] = ['racism', 'discrimination', 'sexism', 'harassment'];

const SYSTEM_PROMPT = `You are a content safety classifier for a Discord server, operating with a progressive worldview and an understanding of the Paradox of Tolerance. Your task is to detect genuinely harmful content while protecting marginalized communities, allowing systemic critique, and understanding comedic context.

For each message, evaluate whether it contains:
- racism: racial slurs, dehumanization, explicit racial hatred, or stereotypes used to demean marginalized racial groups.
- discrimination: content targeting marginalized protected characteristics (religion, disability, nationality, sexual orientation, gender identity, etc.).
- sexism: misogyny, gender-based dehumanization, or sexual objectification. (Note power dynamics; systemic critiques are allowed).
- harassment: targeted personal attacks, severe threats, intimidation, or doxxing attempts.

CRITICAL EVALUATION RULES:
1. The Paradox of Tolerance: Expressing disdain, hatred, or intolerance towards bigoted groups or ideologies (e.g., "I hate Nazis", "fuck transphobes", "homophobes are garbage") is explicitly ALLOWED and must NOT be flagged as discrimination or harassment.
2. The Violence Boundary: While intolerance of bigotry is allowed, violent threats are not. Death threats, incitement of physical violence, or doxxing against ANYONE (including intolerant groups like Nazis or bigots) must be flagged under 'harassment'.
3. Progressive Bias & Power Dynamics: Evaluate content with an understanding of "punching up" vs. "punching down." Venting about systemic oppression or expressing frustration toward privileged groups is not a violation. Focus your detection on speech that targets or endangers marginalized communities.
4. Dark Humor, Satire, & Irony: Dark humor, edgy comedy, and satire SHALL NOT be flagged. If a statement is clearly a joke, hyperbolic irony, or satirical commentary, treat it as safe unless it contains a literal, actionable threat of violence.

Return ONLY a JSON object matching this exact schema, no prose:
{
  "racism":        { "detected": boolean, "confidence": "low"|"medium"|"high" },
  "discrimination":{ "detected": boolean, "confidence": "low"|"medium"|"high" },
  "sexism":        { "detected": boolean, "confidence": "low"|"medium"|"high" },
  "harassment":    { "detected": boolean, "confidence": "low"|"medium"|"high" }
}`;

const DEFAULT_RESULT: HarmDetectionResult = {
  categories: {
    racism: { detected: false, confidence: 'low' },
    discrimination: { detected: false, confidence: 'low' },
    sexism: { detected: false, confidence: 'low' },
    harassment: { detected: false, confidence: 'low' },
  },
  anyDetected: false,
  detectedCategories: [],
};

export class OllamaHarmDetector {
  constructor(
    private readonly endpoint: string,
    private readonly model: string,
    private readonly config: HarmDetectionConfig
  ) {}

  async warmup(): Promise<void> {
    const logger = Logger.getInstance(AppFeature.Surveillance);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${this.endpoint.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: this.model, prompt: 'hello', stream: false }),
      });
      if (res.ok) {
        logger.info('Harm detection model warmed up.');
      } else {
        logger.warn({ status: res.status }, 'Harm detection warmup: unexpected status.');
      }
    } catch (err) {
      logger.warn(Object(err), 'Harm detection warmup failed — first request may be slow.');
    } finally {
      clearTimeout(timer);
    }
  }

  async detect(content: string): Promise<HarmDetectionResult> {
    const logger = Logger.getInstance(AppFeature.Surveillance);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.endpoint.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: this.model, prompt: `${SYSTEM_PROMPT}\n\nMESSAGE: ${JSON.stringify(content)}`, stream: false, format: 'json' }),
      });

      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const body = (await res.json()) as { response?: string };
      if (!body.response) throw new Error('Ollama response missing "response" field');

      const parsed = JSON.parse(body.response) as Record<string, { detected?: unknown; confidence?: unknown }>;
      return this.buildResult(parsed);
    } catch (err) {
      logger.warn(Object(err), 'Harm detection failed — returning safe default.');
      return DEFAULT_RESULT;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildResult(raw: Record<string, { detected?: unknown; confidence?: unknown }>): HarmDetectionResult {
    const categories = {} as Record<HarmCategory, HarmCategoryResult>;

    for (const cat of HARM_CATEGORIES) {
      const entry = raw[cat] ?? {};
      const detected = entry.detected === true && (this.config.categories[cat]?.enabled ?? true);
      const confidence = isConfidence(entry.confidence) ? entry.confidence : 'low';
      categories[cat] = { detected, confidence };
    }

    const detectedCategories = HARM_CATEGORIES.filter((c) => categories[c].detected);
    return { categories, anyDetected: detectedCategories.length > 0, detectedCategories };
  }
}

const isConfidence = (v: unknown): v is HarmCategoryResult['confidence'] => v === 'low' || v === 'medium' || v === 'high';
