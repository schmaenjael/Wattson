import { integer, pgTable, unique, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { appeals } from './appeals';
import { users } from './users';

export const appealVotes = pgTable(
  'appeal_votes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    appealId: integer()
      .notNull()
      .references(() => appeals.id, { onDelete: 'cascade' }),
    voterId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [unique('appeal_votes_appeal_voter').on(t.appealId, t.voterId)]
);
