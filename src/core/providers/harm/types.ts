export type HarmCategory = 'race' | 'sexualOrientation' | 'gender' | 'physicalAppearance' | 'religion' | 'class' | 'disability';
export type HarmAction = 'ignore' | 'flag' | 'warn' | 'ban';

export interface HarmCategoryResult {
  detected: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export interface HarmDetectionResult {
  categories: Record<HarmCategory, HarmCategoryResult>;
  anyDetected: boolean;
  detectedCategories: HarmCategory[];
  /** Identifier of the model that produced this result (from the service /health endpoint). */
  modelVersion: string;
  /** Raw per-label scores returned by the model, for training-data capture. */
  scores: Record<string, number>;
}

export interface HarmCategoryConfig {
  enabled: boolean;
  action: HarmAction;
}

export interface HarmDetectionConfig {
  timeoutMs: number;
  categories: Record<HarmCategory, HarmCategoryConfig>;
}
