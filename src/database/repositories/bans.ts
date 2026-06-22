import { and, count, desc, eq, isNotNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { bans } from '~/database/schema/bans';
import { ModerationStatus } from '~/database/schema/enums';

export type Ban = InferSelectModel<typeof bans>;
export type NewBan = Omit<InferInsertModel<typeof bans>, 'id' | 'createdAt' | 'status'>;

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
  await db.update(bans).set({ status: ModerationStatus.Expired }).where(eq(bans.id, id));
};

export const liftBan = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(bans).set({ status: ModerationStatus.Lifted }).where(eq(bans.id, id));
};

export const listActiveBans = async (): Promise<Ban[]> => {
  const db = getDb();
  return db.select().from(bans).where(eq(bans.status, ModerationStatus.Active)).orderBy(desc(bans.createdAt));
};

export const listExpiredActiveBans = async (now: Date = new Date()): Promise<Ban[]> => {
  const db = getDb();
  return db
    .select()
    .from(bans)
    .where(and(eq(bans.status, ModerationStatus.Active), isNotNull(bans.expiresAt), lte(bans.expiresAt, now)));
};

export const listAllBansForUser = async (targetUserId: string): Promise<Ban[]> => {
  const db = getDb();
  return db.select().from(bans).where(eq(bans.targetUserId, targetUserId)).orderBy(desc(bans.createdAt));
};

export const listActiveBansForUser = async (targetUserId: string): Promise<Ban[]> => {
  const db = getDb();
  return db
    .select()
    .from(bans)
    .where(and(eq(bans.targetUserId, targetUserId), eq(bans.status, ModerationStatus.Active)))
    .orderBy(desc(bans.createdAt));
};

export const deactivateBansForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db
    .update(bans)
    .set({ status: ModerationStatus.Expired })
    .where(and(eq(bans.targetUserId, targetUserId), eq(bans.status, ModerationStatus.Active)))
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

export const findAppealableBan = async (targetUserId: string): Promise<Ban | null> => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bans)
    .where(and(eq(bans.targetUserId, targetUserId), eq(bans.status, ModerationStatus.Active), eq(bans.appealable, true)))
    .limit(1);
  return row ?? null;
};
