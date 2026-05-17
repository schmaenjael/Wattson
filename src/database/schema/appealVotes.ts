import { integer, pgTable, serial, unique, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { bans } from './bans';
import { users } from './users';

export const appealVotes = pgTable(
  'appeal_votes',
  {
    id: serial().primaryKey(),
    banId: integer()
      .notNull()
      .references(() => bans.id),
    voterId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique('appeal_votes_ban_voter').on(t.banId, t.voterId)]
);
