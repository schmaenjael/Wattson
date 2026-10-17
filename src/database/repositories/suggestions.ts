import { and, eq, inArray, isNull, lte, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { suggestions } from '~/database/schema/suggestions';
import { SuggestionStatus } from '~/database/schema/enums';

export type Suggestion = InferSelectModel<typeof suggestions>;
export type NewSuggestion = Pick<InferInsertModel<typeof suggestions>, 'userId' | 'title' | 'description' | 'expiresAt'>;

export const createSuggestion = async (data: NewSuggestion): Promise<Suggestion> => {
  const db = getDb();
  const [row] = await db.insert(suggestions).values(data).returning();
  return row;
};

export const findSuggestionById = async (id: number): Promise<Suggestion | null> => {
  const db = getDb();
  const [row] = await db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1);
  return row ?? null;
};

export const findSuggestionByMessageId = async (messageId: string): Promise<Suggestion | null> => {
  const db = getDb();
  const [row] = await db.select().from(suggestions).where(eq(suggestions.messageId, messageId)).limit(1);
  return row ?? null;
};

export const setSuggestionMessageId = async (id: number, messageId: string): Promise<void> => {
  const db = getDb();
  await db.update(suggestions).set({ messageId }).where(eq(suggestions.id, id));
};

export const setSuggestionApprovalMessageId = async (id: number, approvalMessageId: string): Promise<void> => {
  const db = getDb();
  await db.update(suggestions).set({ approvalMessageId }).where(eq(suggestions.id, id));
};

export const setSuggestionStatus = async (id: number, status: SuggestionStatus): Promise<void> => {
  const db = getDb();
  await db.update(suggestions).set({ status }).where(eq(suggestions.id, id));
};

/**
 * Rows the sweeper still has work for. `approvalMessageId IS NULL` is load-bearing: escalation does
 * not change `status` and cannot move `expiresAt` into the future, so without it every tick would
 * re-select an already-escalated suggestion and post another approval embed with live buttons.
 */
export const listExpiredActiveSuggestions = async (now: Date = new Date()): Promise<Suggestion[]> => {
  const db = getDb();
  return db
    .select()
    .from(suggestions)
    .where(
      and(
        lte(suggestions.expiresAt, now),
        inArray(suggestions.status, [SuggestionStatus.Open, SuggestionStatus.InConsideration]),
        isNull(suggestions.approvalMessageId)
      )
    );
};
