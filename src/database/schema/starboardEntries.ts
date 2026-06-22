import { index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH, createdAt } from './shared';

export const starboardEntries = pgTable(
  'starboard_entries',
  {
    sourceMessageId: varchar({ length: SNOWFLAKE_LENGTH }).primaryKey(),
    starboardMessageId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    authorId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    channelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    starCount: integer().notNull().default(0),
    postedAt: createdAt(),
    lastUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('starboard_entries_author_idx').on(t.authorId)]
);
