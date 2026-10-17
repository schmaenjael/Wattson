import type { Message } from 'discord.js';

import { getSettings } from '~/database';
import { AppFeature } from '~/settings';
import type { MessageContext, PipelineStep } from '~/core/types';
import { AsyncQueue, Logger } from '~/utilities';
import * as antispam from '~/core/providers/antispam';
import * as autoslowmode from '~/core/providers/autoslowmode';
import * as sticky from '~/core/providers/sticky';
import { runAutomod } from '~/core/providers/automod';
import { Client } from './Client';

/**
 * Sequences the per-message safety checks. Each step is isolated like Event's handlers[] loop
 * (a throwing step doesn't block the rest); a step returning true stops the remaining steps
 * (used by antispam once it mutes the author — automod shouldn't also run on that message).
 */
const steps: PipelineStep[] = [sticky.onMessage, autoslowmode.enforce, antispam.recordAndAct, runAutomod];

const queueLogger = Logger.getInstance(AppFeature.Surveillance);
const queue = new AsyncQueue<void>(500, (err) => queueLogger.error(Object(err), 'Message queue task failed'));

const dispatch = async (ctx: MessageContext): Promise<void> => {
  for (const step of steps) {
    try {
      if (await step(ctx)) return;
    } catch (err) {
      ctx.logger.error(Object(err), 'Message pipeline step failed.');
    }
  }
};

/** MessageCreate fan-out entrypoint: queues the surveillance/automod pipeline for a human message. */
export const onMessageCreate = (client: Client, message: Message): void => {
  if (!message.inGuild()) return;
  if (message.author.bot || message.system) return;
  // Not gated on content: an image- or sticker-only flood is still a flood, and antispam plus
  // autoslowmode are the two steps that must count it.
  if (!message.content && message.attachments.size === 0 && message.stickers.size === 0) return;

  const queued = queue.enqueue(async () => {
    const settings = await getSettings();
    const logger = Logger.getInstance(AppFeature.Surveillance);
    await dispatch({ client, message, settings, logger });
  });

  if (!queued) {
    queueLogger.warn({ messageId: message.id }, 'Message queue full — dropped.');
  }
};
