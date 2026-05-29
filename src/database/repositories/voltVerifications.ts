import { and, eq, isNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { voltVerifications } from '../schema/voltVerifications';

export type VoltVerification = InferSelectModel<typeof voltVerifications>;
export type NewVoltVerification = Omit<InferInsertModel<typeof voltVerifications>, 'reverificationNotifiedAt' | 'createdAt'>;

const VERIFICATION_EXPIRY_DAYS = 365;

export const upsertVoltVerification = async (discordUserId: string, logtoSub: string): Promise<VoltVerification> => {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(voltVerifications)
    .values({ discordUserId, logtoSub, verifiedAt: now, expiresAt })
    .onConflictDoUpdate({ target: voltVerifications.discordUserId, set: { logtoSub, verifiedAt: now, expiresAt, reverificationNotifiedAt: null } })
    .returning();
  return row;
};

export const findVerificationByDiscordId = async (discordUserId: string): Promise<VoltVerification | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(voltVerifications).where(eq(voltVerifications.discordUserId, discordUserId)).limit(1);
  return row;
};

export const findVerificationByLogtoSub = async (logtoSub: string): Promise<VoltVerification | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(voltVerifications).where(eq(voltVerifications.logtoSub, logtoSub)).limit(1);
  return row;
};

export const deleteVerification = async (discordUserId: string): Promise<void> => {
  const db = getDb();
  await db.delete(voltVerifications).where(eq(voltVerifications.discordUserId, discordUserId));
};

export const listExpiredVerifications = async (now: Date = new Date()): Promise<VoltVerification[]> => {
  const db = getDb();
  return db.select().from(voltVerifications).where(lte(voltVerifications.expiresAt, now));
};

export const listVerificationsExpiringSoon = async (days: number, now: Date = new Date()): Promise<VoltVerification[]> => {
  const db = getDb();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(voltVerifications)
    .where(and(lte(voltVerifications.expiresAt, threshold), isNull(voltVerifications.reverificationNotifiedAt)));
};

export const setReverificationNotified = async (discordUserId: string): Promise<void> => {
  const db = getDb();
  await db.update(voltVerifications).set({ reverificationNotifiedAt: new Date() }).where(eq(voltVerifications.discordUserId, discordUserId));
};

export const listAllVerifications = async (): Promise<VoltVerification[]> => {
  const db = getDb();
  return db.select().from(voltVerifications);
};
