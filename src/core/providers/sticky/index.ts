import { EmbedBuilder, type Message, type TextChannel } from 'discord.js';

import { listStickyMessages, updateStickyLastMessageId, type StickyMessage } from '~/database';
import { Logger } from '~/utilities';
import { STICKY_COLOR } from './constants';

export type { StickyMessage };

export { sendStickyInfo } from './info';

let cache: Map<string, StickyMessage> | null = null;
const counters = new Map<string, number>();

async function getStickyForChannel(channelId: string): Promise<StickyMessage | null> {
  if (!cache) {
    const all = await listStickyMessages();
    cache = new Map(all.map((s) => [s.channelId, s]));
  }
  return cache.get(channelId) ?? null;
}

export function invalidateStickyCache(): void {
  cache = null;
}

function incrementStickyCounter(channelId: string): number {
  const next = (counters.get(channelId) ?? 0) + 1;
  counters.set(channelId, next);
  return next;
}

function resetStickyCounter(channelId: string): void {
  counters.set(channelId, 0);
}

export async function updateCachedLastMessageId(channelId: string, messageId: string | null): Promise<void> {
  if (cache?.has(channelId)) {
    const entry = cache.get(channelId)!;
    cache.set(channelId, { ...entry, lastMessageId: messageId });
  }
  await updateStickyLastMessageId(channelId, messageId);
}

async function handleStickyRepost(sticky: StickyMessage, channel: TextChannel, logger: ReturnType<typeof Logger.getInstance>): Promise<void> {
  if (sticky.lastMessageId) {
    await channel.messages.delete(sticky.lastMessageId).catch(() => null);
  }

  const embed = new EmbedBuilder()
    .setColor(STICKY_COLOR[sticky.level as keyof typeof STICKY_COLOR] ?? STICKY_COLOR.info)
    .setDescription(sticky.message)
    .setFooter({ text: 'React with ❓ for more information' });

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
    await posted.react('❓');
  } catch (err) {
    logger.error(Object(err), 'Failed to repost sticky message.');
    return;
  }

  await updateCachedLastMessageId(sticky.channelId, posted.id);
}

/** Bumps the channel's sticky counter and reposts (fire-and-forget) once the interval is reached. */
export async function onMessage(message: Message<true>, logger: ReturnType<typeof Logger.getInstance>): Promise<void> {
  const sticky = await getStickyForChannel(message.channelId);
  if (!sticky) return;

  const count = incrementStickyCounter(message.channelId);
  if (count >= sticky.interval) {
    resetStickyCounter(message.channelId);
    void handleStickyRepost(sticky, message.channel as TextChannel, logger);
  }
}
