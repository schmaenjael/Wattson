import { and, count, desc, eq, gte, isNull, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { warnings } from '../schema/warnings';

export type Warning = InferSelectModel<typeof warnings>;
export type NewWarning = Omit<InferInsertModel<typeof warnings>, 'id' | 'createdAt' | 'revokedAt' | 'revokedBy'>;

export const insertWarning = async (input: NewWarning): Promise<Warning> => {
  const db = getDb();
  const [row] = await db.insert(warnings).values(input).returning();
  return row;
};

export const findWarningById = async (id: number): Promise<Warning | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(warnings).where(eq(warnings.id, id)).limit(1);
  return row;
};

export const listWarningsForUser = async (targetUserId: string): Promise<Warning[]> => {
  const db = getDb();
  return db.select().from(warnings).where(eq(warnings.targetUserId, targetUserId)).orderBy(desc(warnings.createdAt));
};

export const countActiveWarningsSince = async (targetUserId: string, since: Date): Promise<number> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(warnings)
    .where(and(eq(warnings.targetUserId, targetUserId), isNull(warnings.revokedAt), gte(warnings.createdAt, since)));
  return rows.length;
};

export const revokeWarning = async (id: number, revokedBy: string): Promise<Warning | undefined> => {
  const db = getDb();
  const [row] = await db.update(warnings).set({ revokedAt: new Date(), revokedBy }).where(eq(warnings.id, id)).returning();
  return row;
};

export const countWarningsForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db.select({ c: count() }).from(warnings).where(eq(warnings.targetUserId, targetUserId));
  return Number(c);
};

export const deleteWarningsForUser = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const result = await db.delete(warnings).where(eq(warnings.targetUserId, targetUserId)).returning();
  return result.length;
};
