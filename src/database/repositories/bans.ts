import { and, count, desc, eq, isNotNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { bans } from '../schema/bans';

export type Ban = InferSelectModel<typeof bans>;
export type NewBan = Omit<InferInsertModel<typeof bans>, 'id' | 'createdAt' | 'active' | 'appealedAt' | 'appealOutcome'>;

export const insertBan = async (input: NewBan): Promise<Ban> => {
  const db = getDb();
  const [row] = await db.insert(bans).values(input).returning();
  return row;
};

export const findBanById = async (id: number): Promise<Ban | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(bans).where(eq(bans.id, id)).limit(1);
  return row;
};

export const deactivateBan = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(bans).set({ active: false }).where(eq(bans.id, id));
};

export const listActiveBans = async (): Promise<Ban[]> => {
  const db = getDb();
  return db.select().from(bans).where(eq(bans.active, true)).orderBy(desc(bans.createdAt));
};

export const listExpiredActiveBans = async (now: Date = new Date()): Promise<Ban[]> => {
  const db = getDb();
  return db
    .select()
    .from(bans)
    .where(and(eq(bans.active, true), isNotNull(bans.expiresAt), lte(bans.expiresAt, now)));
};

export const listActiveBansForUser = async (targetUserId: string): Promise<Ban[]> => {
  const db = getDb();
  return db
    .select()
    .from(bans)
    .where(and(eq(bans.targetUserId, targetUserId), eq(bans.active, true)))
    .orderBy(desc(bans.createdAt));
};

export const deactivateBansForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db
    .update(bans)
    .set({ active: false })
    .where(and(eq(bans.targetUserId, targetUserId), eq(bans.active, true)))
    .returning();
  return result.length;
};

export const countBansForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db.select({ c: count() }).from(bans).where(eq(bans.targetUserId, targetUserId));
  return Number(c);
};

export const deleteBansForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db.delete(bans).where(eq(bans.targetUserId, targetUserId)).returning();
  return result.length;
};
