import { check, integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const lockedChannels = pgTable(
  'locked_channels',
  {
    channelId: varchar({ length: SNOWFLAKE_LENGTH }).primaryKey(),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    previousSlowmode: integer().notNull().default(0),
    lockedAt: createdAt(),
  },
  (t) => [check('locked_channels_reason_nonempty', sql`length(${t.reason}) > 0`)]
);
