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
}

export interface HarmCategoryConfig {
  enabled: boolean;
  action: HarmAction;
}

export interface HarmDetectionConfig {
  timeoutMs: number;
  categories: Record<HarmCategory, HarmCategoryConfig>;
}
