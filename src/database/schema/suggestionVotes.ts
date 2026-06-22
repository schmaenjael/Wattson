import { integer, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

import { suggestionVoteDirectionEnum } from './enums';
import { SNOWFLAKE_LENGTH } from './shared';
import { suggestions } from './suggestions';
import { users } from './users';

/** Private register of who voted what on a suggestion — one row per voter, overwritten when they switch. */
export const suggestionVotes = pgTable(
  'suggestion_votes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    suggestionId: integer()
      .notNull()
      .references(() => suggestions.id, { onDelete: 'cascade' }),
    voterId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    direction: suggestionVoteDirectionEnum().notNull(),
    firstVotedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique('suggestion_votes_suggestion_voter').on(t.suggestionId, t.voterId)]
);
