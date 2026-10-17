import { DiscordAPIError, HTTPError, RESTJSONErrorCodes } from 'discord.js';

import { AppFeature } from '~/settings';
import { Logger } from '~/utilities/Logger';

/**
 * Discord rejections that are part of the normal path: the member left, the message was deleted,
 * the user closed their DMs. These are logged at `debug` so a healthy bot keeps a quiet console;
 * everything else (permissions, gateway/5xx, non-Discord errors) is logged at `warn`.
 */
const EXPECTED_DISCORD_CODES = new Set<number>([
  RESTJSONErrorCodes.UnknownAccount,
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownGuild,
  RESTJSONErrorCodes.UnknownInvite,
  RESTJSONErrorCodes.UnknownMember,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.UnknownRole,
  RESTJSONErrorCodes.UnknownUser,
  RESTJSONErrorCodes.UnknownBan,
  RESTJSONErrorCodes.UnknownEmoji,
  RESTJSONErrorCodes.UnknownInteraction,
  RESTJSONErrorCodes.UnknownWebhook,
  RESTJSONErrorCodes.CannotSendMessagesToThisUser,
  RESTJSONErrorCodes.CannotExecuteActionOnDMChannel,
  RESTJSONErrorCodes.ReactionWasBlocked,
]);

export type SoftFailLevel = 'debug' | 'warn' | 'error';

export interface SoftFailureDetails {
  /** Stable, greppable identifier of the call site, e.g. `MODMAIL_THREAD_FETCH`. */
  errorCode: string;
  /** The upstream error's own code — Discord REST JSON code, Postgres SQLSTATE, or Node `errno`. */
  upstreamCode: string | number | null;
  errorName: string;
  reason: string;
  httpStatus: number | null;
  httpMethod: string | null;
  httpUrl: string | null;
  expected: boolean;
  /** Omitted for expected-absence failures — their stack is noise, not a diagnostic. */
  stack?: string;
}

const inspect = (errorCode: string, error: unknown): SoftFailureDetails => {
  const base: SoftFailureDetails = {
    errorCode,
    upstreamCode: null,
    errorName: 'UnknownError',
    reason: String(error),
    httpStatus: null,
    httpMethod: null,
    httpUrl: null,
    expected: false,
  };

  if (error instanceof DiscordAPIError) {
    const expected = typeof error.code === 'number' && EXPECTED_DISCORD_CODES.has(error.code);
    return {
      ...base,
      upstreamCode: error.code,
      errorName: error.name,
      reason: error.message,
      httpStatus: error.status,
      httpMethod: error.method,
      httpUrl: error.url,
      expected,
      stack: expected ? undefined : error.stack,
    };
  }

  if (error instanceof HTTPError) {
    return {
      ...base,
      errorName: error.name,
      reason: error.message,
      httpStatus: error.status,
      httpMethod: error.method,
      httpUrl: error.url,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    const carrier = error as Error & { code?: string | number };
    return { ...base, upstreamCode: carrier.code ?? null, errorName: error.name, reason: error.message, stack: error.stack };
  }

  return base;
};

/**
 * Writes a swallowed failure to the process log only — never to Discord.
 *
 * Use for "best attempt, no log" call sites: the caller already has a fallback value and does not
 * want a `BotException` embed in the guild, but the failure still has to be diagnosable.
 */
export const logSoftFailure = (
  feature: AppFeature,
  errorCode: string,
  context: Record<string, unknown>,
  error: unknown,
  /** Overrides the Discord-code-derived severity. Use `debug` for rejections that are part of normal operation. */
  level?: SoftFailLevel
): SoftFailureDetails => {
  const details = inspect(errorCode, error);
  const logger = Logger.getInstance(feature);
  const payload = { ...details, ...context };
  const message = `Soft failure [${errorCode}]: ${details.reason}`;

  if (level) {
    logger[level](payload, message);
  } else if (details.expected) {
    logger.debug(payload, message);
  } else {
    logger.warn(payload, message);
  }

  return details;
};

/**
 * Builds a `.catch()` handler that logs the rejection and resolves to `fallback` (default `null`).
 *
 * Replaces `.catch(() => null)`: same control flow, same inferred type, but the failure lands in
 * the console with an error code, the upstream error code and the caller-supplied context.
 */
export function softFail(feature: AppFeature, errorCode: string, context?: Record<string, unknown>): (error: unknown) => null;
export function softFail<T>(feature: AppFeature, errorCode: string, context: Record<string, unknown>, fallback: T): (error: unknown) => T;
export function softFail<T>(feature: AppFeature, errorCode: string, context: Record<string, unknown> = {}, ...fallback: [T] | []) {
  return (error: unknown): T | null => {
    logSoftFailure(feature, errorCode, context, error);
    if (fallback.length === 0) {
      return null;
    }
    const [value] = fallback;
    return value;
  };
}

export interface AttemptOptions {
  feature?: AppFeature;
  errorCode?: string;
  context?: Record<string, unknown>;
  level?: SoftFailLevel;
  onError?: (error: unknown) => void | Promise<void>;
}

/** Runs a best-effort async operation, logging any rejection via {@link logSoftFailure} and returning `null`. */
export async function attempt<T>(fn: () => Promise<T>, options: AttemptOptions = {}): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logSoftFailure(options.feature ?? AppFeature.System, options.errorCode ?? 'BEST_EFFORT_OPERATION', options.context ?? {}, error, options.level);
    await options.onError?.(error);
    return null;
  }
}
