import type { Logger } from '~/utilities/Logger';

/**
 * Runs a Discord side effect and reports whether it actually happened.
 *
 * Exists because `.catch(() => null)` on a role add, kick, ban, delete or channel edit silently
 * decouples Discord state from the database row written straight after it — the recorded outcome
 * then claims something that never occurred. Callers must branch on the returned boolean.
 * Failures go to the process log only; nothing is posted back into the guild.
 */
export const runDiscordAction = async (
  logger: Logger,
  action: string,
  context: Record<string, unknown>,
  fn: () => Promise<unknown>
): Promise<boolean> => {
  try {
    await fn();
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error({ ...context, action, reason: err.message || err.name }, `Discord action failed: ${action}`);
    return false;
  }
};
