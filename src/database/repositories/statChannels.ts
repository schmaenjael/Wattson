import { eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { statChannels } from '~/database/schema/statChannels';
import type { StatChannelType } from '~/database/schema/enums';

export type StatChannel = InferSelectModel<typeof statChannels>;

export const upsertStatChannel = async (statType: StatChannelType, channelId: string): Promise<void> => {
  const db = getDb();
  await db.insert(statChannels).values({ statType, channelId }).onConflictDoUpdate({ target: statChannels.statType, set: { channelId } });
};

export const deleteStatChannel = async (statType: StatChannelType): Promise<boolean> => {
  const db = getDb();
  const deleted = await db.delete(statChannels).where(eq(statChannels.statType, statType)).returning();
  return deleted.length > 0;
};

export const listStatChannels = async (): Promise<StatChannel[]> => {
  const db = getDb();
  return db.select().from(statChannels);
};
