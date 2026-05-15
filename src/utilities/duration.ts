const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 60 * 60_000, d: 24 * 60 * 60_000, w: 7 * 24 * 60 * 60_000 };

/**
 * Parse a human duration string like "30m", "2h", "7d", "1w" → milliseconds.
 * Returns null if the string is not parseable. Accepts integers only.
 */
export const parseDuration = (input: string): number | null => {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  return n * UNIT_MS[unit];
};
