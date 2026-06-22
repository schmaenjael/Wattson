import { check, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { suggestionStatusEnum, SuggestionStatus } from './enums';
import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const SUGGESTION_TITLE_LENGTH = 256;

export const suggestions = pgTable(
  'suggestions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    title: varchar({ length: SUGGESTION_TITLE_LENGTH }).notNull(),
    description: text().notNull(),
    status: suggestionStatusEnum().notNull().default(SuggestionStatus.Open),
    messageId: varchar({ length: SNOWFLAKE_LENGTH }),
    approvalMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('suggestions_active_expires_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} IN ('open', 'in_consideration')`),
    check('suggestions_title_nonempty', sql`length(${t.title}) > 0`),
    check('suggestions_description_nonempty', sql`length(${t.description}) > 0`),
  ]
);
