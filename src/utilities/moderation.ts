import type { User } from 'discord.js';

const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 60 * 60_000, d: 24 * 60 * 60_000, w: 7 * 24 * 60 * 60_000 };

const parseDuration = (input: string): number | null => {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
};

export const validateModerationTarget = (target: User, actor: User, action: string): string | null => {
  if (target.id === actor.id) return `You cannot ${action} yourself.`;
  if (target.bot) return `You cannot ${action} a bot.`;
  return null;
};

export const resolveExpiresAt = (durationStr: string | null): Date | null | 'invalid' => {
  if (!durationStr) return null;
  const ms = parseDuration(durationStr);
  if (!ms) return 'invalid';
  return new Date(Date.now() + ms);
};
