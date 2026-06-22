import { count, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { suggestionVotes } from '~/database/schema/suggestionVotes';
import { SuggestionVoteDirection } from '~/database/schema/enums';

export type SuggestionVote = InferSelectModel<typeof suggestionVotes>;
export type SuggestionVoteTally = { upvotes: number; downvotes: number };

export const setSuggestionVote = async (suggestionId: number, voterId: string, direction: SuggestionVoteDirection): Promise<void> => {
  const db = getDb();
  await db
    .insert(suggestionVotes)
    .values({ suggestionId, voterId, direction })
    .onConflictDoUpdate({ target: [suggestionVotes.suggestionId, suggestionVotes.voterId], set: { direction, updatedAt: new Date() } });
};

export const countSuggestionVotes = async (suggestionId: number): Promise<SuggestionVoteTally> => {
  const db = getDb();
  const rows = await db
    .select({ direction: suggestionVotes.direction, c: count() })
    .from(suggestionVotes)
    .where(eq(suggestionVotes.suggestionId, suggestionId))
    .groupBy(suggestionVotes.direction);

  const tally: SuggestionVoteTally = { upvotes: 0, downvotes: 0 };
  for (const row of rows) {
    if (row.direction === SuggestionVoteDirection.Up) {
      tally.upvotes = Number(row.c);
    } else if (row.direction === SuggestionVoteDirection.Down) {
      tally.downvotes = Number(row.c);
    }
  }
  return tally;
};
