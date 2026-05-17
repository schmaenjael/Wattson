import { and, count, desc, eq, gt, gte, isNull, or, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { warnings } from '../schema/warnings';

export const WARNING_DEFAULT_EXPIRY_DAYS = 30;

export type Warning = InferSelectModel<typeof warnings>;
export type NewWarning = Omit<InferInsertModel<typeof warnings>, 'id' | 'createdAt' | 'revokedAt' | 'revokedBy'>;

export const insertWarning = async (input: NewWarning): Promise<Warning> => {
  const db = getDb();
  const expiresAt = input.expiresAt !== undefined ? input.expiresAt : new Date(Date.now() + WARNING_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(warnings)
    .values({ ...input, expiresAt })
    .returning();
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

export const countActiveWarnings = async (targetUserId: string): Promise<number> => {
  const db = getDb();
  const now = new Date();
  const [{ c }] = await db
    .select({ c: count() })
    .from(warnings)
    .where(and(eq(warnings.targetUserId, targetUserId), isNull(warnings.revokedAt), or(isNull(warnings.expiresAt), gt(warnings.expiresAt, now))));
  return Number(c);
};

export const countActiveWarningsSince = async (targetUserId: string, since: Date): Promise<number> => {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(warnings)
    .where(
      and(
        eq(warnings.targetUserId, targetUserId),
        isNull(warnings.revokedAt),
        gte(warnings.createdAt, since),
        or(isNull(warnings.expiresAt), gt(warnings.expiresAt, now))
      )
    );
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
