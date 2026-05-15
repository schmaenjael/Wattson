import { readFileSync } from 'fs';
import { join } from 'path';

import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { HarmDetectionConfig } from './types';
import { OllamaHarmDetector } from './ollama';

export * from './types';
export { OllamaHarmDetector };

const CONFIG_PATH = join(process.cwd(), 'config', 'harm-detection.json');
const DEFAULT_ENDPOINT = 'http://ollama:11434';

let cached: OllamaHarmDetector | null = null;

export const getHarmDetector = (): OllamaHarmDetector | null => {
  if (cached) return cached;

  const model = process.env.OLLAMA_MODEL;
  if (!model) {
    Logger.getInstance(AppFeature.Surveillance).warn('OLLAMA_MODEL env var not set — harm detection disabled.');
    return null;
  }

  const endpoint = process.env.OLLAMA_ENDPOINT ?? DEFAULT_ENDPOINT;

  let config: HarmDetectionConfig;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as HarmDetectionConfig;
  } catch (err) {
    Logger.getInstance(AppFeature.Surveillance).warn(Object(err), 'harm-detection.json not found — harm detection disabled.');
    return null;
  }

  cached = new OllamaHarmDetector(endpoint, model, config);
  return cached;
};

export const invalidateHarmDetector = (): void => {
  cached = null;
};

export const warmupHarmDetector = async (): Promise<void> => {
  const detector = getHarmDetector();
  if (!detector) return;
  await detector.warmup();
};
