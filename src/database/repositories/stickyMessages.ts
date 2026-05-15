import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { stickyMessages } from '../schema';

export type StickyMessage = InferSelectModel<typeof stickyMessages>;
export type NewStickyMessage = Omit<InferInsertModel<typeof stickyMessages>, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageId'>;

export const upsertStickyMessage = async (input: NewStickyMessage): Promise<StickyMessage> => {
  const db = getDb();
  const [row] = await db
    .insert(stickyMessages)
    .values(input)
    .onConflictDoUpdate({
      target: stickyMessages.channelId,
      set: { message: input.message, level: input.level, interval: input.interval, extendedExplanation: input.extendedExplanation },
    })
    .returning();
  return row;
};

export const getStickyByChannelId = async (channelId: string): Promise<StickyMessage | null> => {
  const db = getDb();
  const [row] = await db.select().from(stickyMessages).where(eq(stickyMessages.channelId, channelId));
  return row ?? null;
};

export const getStickyByLastMessageId = async (messageId: string): Promise<StickyMessage | null> => {
  const db = getDb();
  const [row] = await db.select().from(stickyMessages).where(eq(stickyMessages.lastMessageId, messageId));
  return row ?? null;
};

export const updateStickyLastMessageId = async (channelId: string, messageId: string | null): Promise<void> => {
  const db = getDb();
  await db.update(stickyMessages).set({ lastMessageId: messageId }).where(eq(stickyMessages.channelId, channelId));
};

export const deleteStickyByChannelId = async (channelId: string): Promise<void> => {
  const db = getDb();
  await db.delete(stickyMessages).where(eq(stickyMessages.channelId, channelId));
};

export const listStickyMessages = async (): Promise<StickyMessage[]> => {
  const db = getDb();
  return db.select().from(stickyMessages);
};
