import { getConfig } from '~/config';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { HarmCategory, HarmCategoryResult, HarmDetectionConfig, HarmDetectionResult } from './types';

// Maps the model's string labels to our internal HarmCategory keys.
// "Appropriate" is intentionally absent — it means no harm detected.
const CATEGORY_MAP: Record<string, HarmCategory> = {
  Race: 'race',
  'Sexual Orientation': 'sexualOrientation',
  Gender: 'gender',
  'Physical Appearance': 'physicalAppearance',
  Religion: 'religion',
  Class: 'class',
  Disability: 'disability',
};

const HARM_CATEGORIES: HarmCategory[] = ['race', 'sexualOrientation', 'gender', 'physicalAppearance', 'religion', 'class', 'disability'];

const DEFAULT_RESULT: HarmDetectionResult = {
  categories: {
    race: { detected: false, confidence: 'low' },
    sexualOrientation: { detected: false, confidence: 'low' },
    gender: { detected: false, confidence: 'low' },
    physicalAppearance: { detected: false, confidence: 'low' },
    religion: { detected: false, confidence: 'low' },
    class: { detected: false, confidence: 'low' },
    disability: { detected: false, confidence: 'low' },
  },
  anyDetected: false,
  detectedCategories: [],
  modelVersion: 'unknown',
  scores: {},
};

const toConfidenceLevel = (score: number): HarmCategoryResult['confidence'] => {
  if (score >= 0.92) return 'high';
  if (score >= 0.75) return 'medium';
  return 'low';
};

interface HsdApiResponse {
  category: string;
  confidence: number;
  all_scores?: Record<string, number>;
}

interface HsdHealthResponse {
  status: string;
  model?: string;
}

export class HateSpeechDetector {
  private available = true;
  private modelVersion = 'unknown';

  constructor(
    private readonly endpoint: string,
    private readonly config: HarmDetectionConfig
  ) {}

  async warmup(): Promise<void> {
    const logger = Logger.getInstance(AppFeature.Surveillance);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), getConfig().config.timeouts.harmMs);
    try {
      const res = await fetch(`${this.endpoint.replace(/\/$/, '')}/health`, { signal: controller.signal });
      if (res.ok) {
        const body = (await res.json()) as HsdHealthResponse;
        if (body.model) this.modelVersion = body.model;
        logger.info({ model: this.modelVersion }, 'Hate speech detection service ready.');
      } else {
        logger.warn({ status: res.status }, 'Hate speech detection warmup: unexpected status.');
      }
    } catch (err) {
      this.available = false;
      logger.warn(Object(err), 'Hate speech detection unavailable — detect calls will be skipped.');
    } finally {
      clearTimeout(timer);
    }
  }

  async detect(content: string): Promise<HarmDetectionResult> {
    if (!this.available) return DEFAULT_RESULT;

    const logger = Logger.getInstance(AppFeature.Surveillance);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.endpoint.replace(/\/$/, '')}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ text: content }),
      });

      if (!res.ok) throw new Error(`HSD HTTP ${res.status}`);
      const body = (await res.json()) as HsdApiResponse;

      const mappedCategory = CATEGORY_MAP[body.category];
      if (!mappedCategory) {
        return DEFAULT_RESULT;
      }

      const enabled = this.config.categories[mappedCategory]?.enabled ?? true;
      if (!enabled) {
        return DEFAULT_RESULT;
      }

      const confidenceLevel = toConfidenceLevel(body.confidence);
      const categories = Object.fromEntries(
        HARM_CATEGORIES.map((cat) => [
          cat,
          { detected: cat === mappedCategory, confidence: cat === mappedCategory ? confidenceLevel : ('low' as const) },
        ])
      ) as Record<HarmCategory, HarmCategoryResult>;

      return { categories, anyDetected: true, detectedCategories: [mappedCategory], modelVersion: this.modelVersion, scores: body.all_scores ?? {} };
    } catch (err) {
      logger.warn(Object(err), 'Hate speech detection failed — returning safe default.');
      return DEFAULT_RESULT;
    } finally {
      clearTimeout(timer);
    }
  }
}
