import { and, count, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { appealVotes } from '../schema/appealVotes';

export type AppealVote = InferSelectModel<typeof appealVotes>;

export const addAppealVote = async (banId: number, voterId: string): Promise<void> => {
  const db = getDb();
  await db.insert(appealVotes).values({ banId, voterId }).onConflictDoNothing();
};

export const countAppealVotes = async (banId: number): Promise<number> => {
  const db = getDb();
  const [{ c }] = await db.select({ c: count() }).from(appealVotes).where(eq(appealVotes.banId, banId));
  return Number(c);
};

export const hasVotedAppeal = async (banId: number, voterId: string): Promise<boolean> => {
  const db = getDb();
  const [row] = await db
    .select({ id: appealVotes.id })
    .from(appealVotes)
    .where(and(eq(appealVotes.banId, banId), eq(appealVotes.voterId, voterId)))
    .limit(1);
  return !!row;
};
