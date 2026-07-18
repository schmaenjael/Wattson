import type { Message } from 'discord.js';

import { getSettings, type Settings } from '~/database';
import { AppFeature } from '~/settings';
import { AsyncQueue, Logger } from '~/utilities';
import * as antispam from '~/core/providers/antispam';
import * as autoslowmode from '~/core/providers/autoslowmode';
import * as sticky from '~/core/providers/sticky';
import { runAutomod } from '~/core/providers/automod';
import { Client } from './Client';

interface MessageContext {
  client: Client;
  message: Message<true>;
  settings: Settings;
  logger: ReturnType<typeof Logger.getInstance>;
}

type PipelineStep = (ctx: MessageContext) => Promise<boolean | void>;

/**
 * Sequences the per-message safety checks. Each step is isolated like Event's handlers[] loop
 * (a throwing step doesn't block the rest); a step returning true stops the remaining steps
 * (used by antispam once it mutes the author — automod shouldn't also run on that message).
 */
const steps: PipelineStep[] = [
  (ctx) => sticky.onMessage(ctx.message, ctx.logger),
  (ctx) => autoslowmode.enforce(ctx.client, ctx.message, ctx.settings, ctx.logger),
  (ctx) => antispam.recordAndAct(ctx.client, ctx.message, ctx.settings, ctx.logger),
  (ctx) => runAutomod(ctx.message, ctx.settings),
];

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
  if (!message.content) return;

  const queued = queue.enqueue(async () => {
    const settings = await getSettings();
    const logger = Logger.getInstance(AppFeature.Surveillance);
    await dispatch({ client, message, settings, logger });
  });

  if (!queued) {
    queueLogger.warn({ messageId: message.id }, 'Message queue full — dropped.');
  }
};
