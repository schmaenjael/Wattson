import { readFileSync } from 'fs';
import { join } from 'path';

import JSON5 from 'json5';

import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import type { HarmDetectionConfig } from './types';
import { HateSpeechDetector } from './hsd';

export type { HarmCategory, HarmDetectionResult } from './types';

const CONFIG_PATH = join(process.cwd(), 'config', 'harm-detection.json5');
const DEFAULT_ENDPOINT = 'http://hate-speech-detector:8000';

let cached: HateSpeechDetector | null = null;

export const getHarmDetector = (): HateSpeechDetector | null => {
  if (cached) return cached;

  const endpoint = process.env.HATE_SPEECH_DETECTOR_ENDPOINT ?? DEFAULT_ENDPOINT;

  let config: HarmDetectionConfig;
  try {
    config = JSON5.parse(readFileSync(CONFIG_PATH, 'utf-8')) as HarmDetectionConfig;
  } catch (err) {
    Logger.getInstance(AppFeature.Surveillance).warn(Object(err), 'harm-detection.json5 not found — harm detection disabled.');
    return null;
  }

  cached = new HateSpeechDetector(endpoint, config);
  return cached;
};

export const warmupHarmDetector = async (): Promise<void> => {
  const detector = getHarmDetector();
  if (!detector) return;
  await detector.warmup();
};
