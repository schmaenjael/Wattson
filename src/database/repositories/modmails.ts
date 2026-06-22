import { and, eq, isNotNull, isNull, lt, or, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { modmails } from '~/database/schema/modmails';
import { ModmailStatus } from '~/database/schema/enums';

export type Modmail = InferSelectModel<typeof modmails>;
type ModmailInsert = Omit<InferInsertModel<typeof modmails>, 'id' | 'createdAt' | 'lastActivityAt'>;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const openModmail = async (data: ModmailInsert): Promise<Modmail> => {
  const db = getDb();
  const [row] = await db.insert(modmails).values(data).returning();
  return row;
};

export const findOpenModmailByUserId = async (userId: string): Promise<Modmail | null> => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(modmails)
    .where(and(eq(modmails.userId, userId), or(eq(modmails.status, ModmailStatus.Open), eq(modmails.status, ModmailStatus.StalePending))))
    .limit(1);
  return row ?? null;
};

export const findModmailById = async (id: number): Promise<Modmail | null> => {
  const db = getDb();
  const [row] = await db.select().from(modmails).where(eq(modmails.id, id)).limit(1);
  return row ?? null;
};

export const findModmailByThreadId = async (threadId: string): Promise<Modmail | null> => {
  const db = getDb();
  const [row] = await db.select().from(modmails).where(eq(modmails.threadId, threadId)).limit(1);
  return row ?? null;
};

export const closeModmail = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(modmails).set({ status: ModmailStatus.Closed, closedAt: new Date() }).where(eq(modmails.id, id));
};

export const touchModmailActivity = async (id: number): Promise<void> => {
  const db = getDb();
  await db
    .update(modmails)
    .set({ lastActivityAt: new Date(), reminderSentAt: null, status: ModmailStatus.Open, staleNotifiedAt: null })
    .where(eq(modmails.id, id));
};

export const listModmailsPendingReminder = async (): Promise<Modmail[]> => {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
  return db
    .select()
    .from(modmails)
    .where(and(eq(modmails.status, ModmailStatus.Open), lt(modmails.lastActivityAt, sevenDaysAgo), isNull(modmails.reminderSentAt)));
};

export const setReminderSent = async (id: number): Promise<void> => {
  const db = getDb();
  await db.update(modmails).set({ reminderSentAt: new Date() }).where(eq(modmails.id, id));
};

export const listModmailsPendingStale = async (): Promise<Modmail[]> => {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  return db
    .select()
    .from(modmails)
    .where(and(eq(modmails.status, ModmailStatus.Open), lt(modmails.createdAt, thirtyDaysAgo), isNull(modmails.staleNotifiedAt)));
};

export const setModmailStalePending = async (id: number, staleMessageId: string | null, staleDmMessageId: string | null): Promise<void> => {
  const db = getDb();
  await db
    .update(modmails)
    .set({ status: ModmailStatus.StalePending, staleNotifiedAt: new Date(), staleMessageId, staleDmMessageId })
    .where(eq(modmails.id, id));
};

export const listStalePendingExpired = async (): Promise<Modmail[]> => {
  const db = getDb();
  const twentyFourHoursAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  return db
    .select()
    .from(modmails)
    .where(
      and(eq(modmails.status, ModmailStatus.StalePending), isNotNull(modmails.staleNotifiedAt), lt(modmails.staleNotifiedAt, twentyFourHoursAgo))
    );
};

export const resetModmailFromStale = async (id: number): Promise<void> => {
  const db = getDb();
  await db
    .update(modmails)
    .set({ status: ModmailStatus.Open, staleNotifiedAt: null, staleMessageId: null, staleDmMessageId: null, lastActivityAt: new Date() })
    .where(eq(modmails.id, id));
};

export const setModmailSummary = async (id: number, summary: string): Promise<void> => {
  const db = getDb();
  await db.update(modmails).set({ summary }).where(eq(modmails.id, id));
};

export const setModmailChannelMessage = async (id: number, channelMessageId: string): Promise<void> => {
  const db = getDb();
  await db.update(modmails).set({ channelMessageId }).where(eq(modmails.id, id));
};
