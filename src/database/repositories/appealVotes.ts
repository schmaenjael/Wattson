import { and, count, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { appealVotes } from '~/database/schema/appealVotes';

export type AppealVote = InferSelectModel<typeof appealVotes>;

export const addAppealVote = async (appealId: number, voterId: string): Promise<void> => {
  const db = getDb();
  await db.insert(appealVotes).values({ appealId, voterId }).onConflictDoNothing();
};

export const countAppealVotes = async (appealId: number): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db.select({ c: count() }).from(appealVotes).where(eq(appealVotes.appealId, appealId));
  return Number(c);
};

export const hasVotedAppeal = async (appealId: number, voterId: string): Promise<boolean> => {
  const db = getDb();
  const [row] = await db
    .select({ id: appealVotes.id })
    .from(appealVotes)
    .where(and(eq(appealVotes.appealId, appealId), eq(appealVotes.voterId, voterId)))
    .limit(1);
  return !!row;
};
