import type { User } from 'discord.js';

import { parseDuration } from './duration';

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
