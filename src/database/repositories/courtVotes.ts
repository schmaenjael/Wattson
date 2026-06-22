import { count, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { courtVotes } from '~/database/schema/courtVotes';
import { CourtVoteOption } from '~/database/schema/enums';

export type CourtVote = InferSelectModel<typeof courtVotes>;

export const upsertCourtVote = async (caseId: number, moderatorId: string, vote: CourtVoteOption): Promise<void> => {
  const db = getDb();
  await db
    .insert(courtVotes)
    .values({ caseId, moderatorId, vote })
    .onConflictDoUpdate({ target: [courtVotes.caseId, courtVotes.moderatorId], set: { vote } });
};

export const getVoteTallies = async (caseId: number): Promise<{ ban: number; warn: number; dismiss: number }> => {
  const db = getDb();
  const rows = await db.select({ vote: courtVotes.vote, c: count() }).from(courtVotes).where(eq(courtVotes.caseId, caseId)).groupBy(courtVotes.vote);

  const result = { ban: 0, warn: 0, dismiss: 0 };
  for (const row of rows) {
    result[row.vote] = Number(row.c);
  }
  return result;
};
