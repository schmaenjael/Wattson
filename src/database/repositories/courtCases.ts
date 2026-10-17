import { and, desc, eq, or, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { courtCases } from '~/database/schema/courtCases';
import { CourtStatus } from '~/database/schema/enums';

export type CourtCase = InferSelectModel<typeof courtCases>;
export type NewCourtCase = Omit<InferInsertModel<typeof courtCases>, 'id' | 'openedAt' | 'closedAt' | 'closedBy' | 'verdict' | 'status'>;

export const insertCourtCase = async (input: NewCourtCase): Promise<CourtCase> => {
  const db = getDb();
  const [row] = await db.insert(courtCases).values(input).returning();
  return row;
};

export const findCaseById = async (id: number): Promise<CourtCase | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(courtCases).where(eq(courtCases.id, id)).limit(1);
  return row;
};

export const findActiveCaseByThreadId = async (threadId: string): Promise<CourtCase | undefined> => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(courtCases)
    .where(and(eq(courtCases.threadId, threadId), or(eq(courtCases.status, CourtStatus.Open), eq(courtCases.status, CourtStatus.Finalizing))))
    .limit(1);
  return row;
};

export const setCourtCaseFinalizing = async (id: number, voteMessageId: string): Promise<CourtCase | undefined> => {
  const db = getDb();
  const [row] = await db.update(courtCases).set({ status: CourtStatus.Finalizing, voteMessageId }).where(eq(courtCases.id, id)).returning();
  return row;
};

export const findOpenCaseForUser = async (accusedUserId: string): Promise<CourtCase | undefined> => {
  const db = getDb();
  const [row] = await db
    .select()
    .from(courtCases)
    .where(and(eq(courtCases.accusedUserId, accusedUserId), eq(courtCases.status, CourtStatus.Open)))
    .limit(1);
  return row;
};

export const listOpenCases = async (): Promise<CourtCase[]> => {
  const db = getDb();
  return db.select().from(courtCases).where(eq(courtCases.status, CourtStatus.Open)).orderBy(desc(courtCases.openedAt));
};

export const listCasesForUser = async (accusedUserId: string): Promise<CourtCase[]> => {
  const db = getDb();
  return db.select().from(courtCases).where(eq(courtCases.accusedUserId, accusedUserId)).orderBy(desc(courtCases.openedAt));
};

/**
 * Closes a case. Pass `fromStatus` to make the update a compare-and-swap: the row is only written
 * when it is still in that status, so concurrent callers cannot both win. Returns undefined when
 * the predicate did not match — the caller lost the race and must not run the verdict's side effects.
 */
export const closeCourtCase = async (
  id: number,
  closedBy: string,
  status: CourtStatus,
  verdict: string | null,
  summary?: string | null,
  fromStatus?: CourtStatus
): Promise<CourtCase | undefined> => {
  const db = getDb();
  const predicate = fromStatus ? and(eq(courtCases.id, id), eq(courtCases.status, fromStatus)) : eq(courtCases.id, id);
  const [row] = await db
    .update(courtCases)
    .set({ status, closedBy, closedAt: new Date(), verdict, summary: summary ?? null })
    .where(predicate)
    .returning();
  return row;
};
