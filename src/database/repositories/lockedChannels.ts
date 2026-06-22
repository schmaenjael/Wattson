import { eq, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { lockedChannels } from '~/database/schema/lockedChannels';

export type LockedChannel = InferSelectModel<typeof lockedChannels>;
type LockedChannelInsert = Omit<InferInsertModel<typeof lockedChannels>, 'lockedAt' | 'previousSlowmode'> & { previousSlowmode: number };

export const lockChannel = async (data: LockedChannelInsert): Promise<void> => {
  const db = getDb();
  await db.insert(lockedChannels).values(data).onConflictDoNothing();
};

export const unlockChannel = async (channelId: string): Promise<void> => {
  const db = getDb();
  await db.delete(lockedChannels).where(eq(lockedChannels.channelId, channelId));
};

export const findLockedChannel = async (channelId: string): Promise<LockedChannel | null> => {
  const db = getDb();
  const [row] = await db.select().from(lockedChannels).where(eq(lockedChannels.channelId, channelId)).limit(1);
  return row ?? null;
};

export const listLockedChannels = async (): Promise<LockedChannel[]> => {
  const db = getDb();
  return db.select().from(lockedChannels);
};

export const clearAllLockedChannels = async (): Promise<void> => {
  const db = getDb();
  await db.delete(lockedChannels);
};
