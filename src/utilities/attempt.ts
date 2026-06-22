import { AppFeature } from '~/settings';
import { Logger } from '~/utilities/Logger';

const logger = Logger.getInstance(AppFeature.System);

export async function attempt<T>(fn: () => Promise<T>, onError?: (error: unknown) => void | Promise<void>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logger.warn({ err: error }, 'best-effort operation failed');
    await onError?.(error);
    return null;
  }
}
