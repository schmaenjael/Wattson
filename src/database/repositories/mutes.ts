import { and, eq, isNotNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { mutes } from '../schema/mutes';

export type Mute = InferSelectModel<typeof mutes>;
export type NewMute = Omit<InferInsertModel<typeof mutes>, 'id' | 'createdAt' | 'active'>;

export const insertMute = async (input: NewMute): Promise<Mute> => {
  const db = getDb();
  const [row] = await db.insert(mutes).values(input).returning();
  return row;
};

export const deactivateMute = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(mutes).set({ active: false }).where(eq(mutes.id, id));
};

export const listExpiredActiveMutes = async (now: Date = new Date()): Promise<Mute[]> => {
  const db = getDb();
  return db
    .select()
    .from(mutes)
    .where(and(eq(mutes.active, true), isNotNull(mutes.expiresAt), lte(mutes.expiresAt, now)));
};

export const listActiveMutesForUser = async (targetUserId: string): Promise<Mute[]> => {
  const db = getDb();
  return db
    .select()
    .from(mutes)
    .where(and(eq(mutes.targetUserId, targetUserId), eq(mutes.active, true)));
};

export const deactivateMutesForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db
    .update(mutes)
    .set({ active: false })
    .where(and(eq(mutes.targetUserId, targetUserId), eq(mutes.active, true)))
    .returning();
  return result.length;
};
