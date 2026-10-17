import type { Snowflake } from 'discord.js';

/**
 * Message IDs whose upcoming `messageDelete` gateway event must not be surveilled, because a moderator
 * command already audited the removal. Entries expire so a delete that never fires cannot leak the ID.
 */
const suppressed = new Map<Snowflake, number>();

const SUPPRESSION_TTL_MS = 60_000;

const sweep = (now: number): void => {
  for (const [messageId, expiresAt] of suppressed) {
    if (expiresAt <= now) {
      suppressed.delete(messageId);
    }
  }
};

/** Marks a message as moderator-deleted before the delete call, so the surveillance handler skips it. */
export const suppressMessageDeleteLog = (messageId: Snowflake): void => {
  const now = Date.now();
  sweep(now);
  suppressed.set(messageId, now + SUPPRESSION_TTL_MS);
};

/** Returns true (and clears the mark) when the delete was announced via {@link suppressMessageDeleteLog}. */
export const consumeMessageDeleteSuppression = (messageId: Snowflake): boolean => {
  const expiresAt = suppressed.get(messageId);
  suppressed.delete(messageId);
  return expiresAt !== undefined && expiresAt > Date.now();
};
