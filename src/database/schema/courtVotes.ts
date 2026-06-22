import { integer, pgTable, unique, varchar } from 'drizzle-orm/pg-core';

import { courtVoteOptionEnum, CourtVoteOption } from './enums';
import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { courtCases } from './courtCases';
import { users } from './users';

export const courtVotes = pgTable(
  'court_votes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    caseId: integer()
      .notNull()
      .references(() => courtCases.id, { onDelete: 'cascade' }),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    vote: courtVoteOptionEnum().notNull().$type<CourtVoteOption>(),
    votedAt: createdAt(),
  },
  (t) => [unique('court_votes_case_moderator').on(t.caseId, t.moderatorId)]
);
