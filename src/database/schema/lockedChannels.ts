import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const lockedChannels = pgTable('locked_channels', {
  channelId: varchar({ length: SNOWFLAKE_LENGTH }).primaryKey(),
  moderatorId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  reason: varchar({ length: REASON_LENGTH }).notNull(),
  previousSlowmode: integer().notNull().default(0),
  lockedAt: createdAt(),
});
