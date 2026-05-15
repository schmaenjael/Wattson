import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

export interface CompiledPattern {
  raw: string;
  severity: number;
  regex: RegExp;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Loads config/bad-words.txt (or any file at the given path).
 *
 * Line format:  <pattern> <severity> [r]
 *   pattern  — word or regex fragment (no spaces unless using r flag)
 *   severity — integer 1–5
 *   r        — optional flag: treat pattern as raw regex (not auto word-boundary wrapped)
 *
 * Without r: pattern is automatically wrapped as \b<escaped>\b
 * With r:    pattern is compiled as-is; add \b manually if needed
 *
 * Lines starting with # and blank lines are ignored.
 */
export async function loadProfanityList(filePath: string): Promise<CompiledPattern[]> {
  const logger = Logger.getInstance(AppFeature.Profanity);
  let text: string;

  try {
    text = await import('node:fs/promises').then((fs) => fs.readFile(filePath, 'utf-8'));
  } catch (err) {
    logger.error({ filePath, err: Object(err) }, 'Failed to load profanity list file.');
    return [];
  }

  const patterns: CompiledPattern[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const isRegex = parts[parts.length - 1] === 'r';
    const severityStr = isRegex ? parts[parts.length - 2] : parts[parts.length - 1];
    const patternParts = isRegex ? parts.slice(0, -2) : parts.slice(0, -1);
    const raw = patternParts.join(' ');

    const severity = parseInt(severityStr, 10);
    if (!raw || isNaN(severity) || severity < 1 || severity > 5) {
      logger.warn({ line: trimmed }, 'Skipping malformed profanity list entry.');
      continue;
    }

    const source = isRegex ? raw : `\\b${escapeRegex(raw)}\\b`;

    try {
      patterns.push({ raw, severity, regex: new RegExp(source, 'iu') });
    } catch (err) {
      logger.error({ raw, err: Object(err) }, 'Invalid profanity pattern — skipping.');
    }
  }

  logger.info({ filePath, count: patterns.length }, 'Profanity list loaded.');
  return patterns;
}
