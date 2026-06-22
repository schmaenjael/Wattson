import { and, eq, isNotNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { mutes } from '~/database/schema/mutes';
import { ModerationStatus } from '~/database/schema/enums';

export type Mute = InferSelectModel<typeof mutes>;
export type NewMute = Omit<InferInsertModel<typeof mutes>, 'id' | 'createdAt' | 'status'>;

export const insertMute = async (input: NewMute): Promise<Mute> => {
  const db = getDb();
  const [row] = await db.insert(mutes).values(input).returning();
  return row;
};

export const deactivateMute = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(mutes).set({ status: ModerationStatus.Expired }).where(eq(mutes.id, id));
};

export const liftMute = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(mutes).set({ status: ModerationStatus.Lifted }).where(eq(mutes.id, id));
};

export const listExpiredActiveMutes = async (now: Date = new Date()): Promise<Mute[]> => {
  const db = getDb();
  return db
    .select()
    .from(mutes)
    .where(and(eq(mutes.status, ModerationStatus.Active), isNotNull(mutes.expiresAt), lte(mutes.expiresAt, now)));
};

export const listActiveMutesForUser = async (targetUserId: string): Promise<Mute[]> => {
  const db = getDb();
  return db
    .select()
    .from(mutes)
    .where(and(eq(mutes.targetUserId, targetUserId), eq(mutes.status, ModerationStatus.Active)));
};

export const deactivateMutesForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db
    .update(mutes)
    .set({ status: ModerationStatus.Expired })
    .where(and(eq(mutes.targetUserId, targetUserId), eq(mutes.status, ModerationStatus.Active)))
    .returning();
  return result.length;
};
