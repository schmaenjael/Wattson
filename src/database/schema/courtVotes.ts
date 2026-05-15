import { integer, pgTable, serial, unique, varchar } from 'drizzle-orm/pg-core';

import { courtVoteOptionEnum, CourtVoteOption } from './enums';
import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { courtCases } from './courtCases';
import { users } from './users';

export const courtVotes = pgTable(
  'court_votes',
  {
    id: serial().primaryKey(),
    caseId: integer()
      .notNull()
      .references(() => courtCases.id),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    vote: courtVoteOptionEnum().notNull().$type<CourtVoteOption>(),
    votedAt: createdAt(),
  },
  (t) => [unique('court_votes_case_moderator').on(t.caseId, t.moderatorId)]
);
