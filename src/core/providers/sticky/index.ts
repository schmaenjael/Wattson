import { listStickyMessages, updateStickyLastMessageId, type StickyMessage } from '~/database';

export type { StickyMessage };

let cache: Map<string, StickyMessage> | null = null;
const counters = new Map<string, number>();

export async function getStickyForChannel(channelId: string): Promise<StickyMessage | null> {
  if (!cache) {
    const all = await listStickyMessages();
    cache = new Map(all.map((s) => [s.channelId, s]));
  }
  return cache.get(channelId) ?? null;
}

export function invalidateStickyCache(): void {
  cache = null;
}

export function incrementStickyCounter(channelId: string): number {
  const next = (counters.get(channelId) ?? 0) + 1;
  counters.set(channelId, next);
  return next;
}

export function resetStickyCounter(channelId: string): void {
  counters.set(channelId, 0);
}

export async function updateCachedLastMessageId(channelId: string, messageId: string | null): Promise<void> {
  if (cache?.has(channelId)) {
    const entry = cache.get(channelId)!;
    cache.set(channelId, { ...entry, lastMessageId: messageId });
  }
  await updateStickyLastMessageId(channelId, messageId);
}
