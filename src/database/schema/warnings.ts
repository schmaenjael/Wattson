import { pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const warnings = pgTable('warnings', {
  id: serial().primaryKey(),
  targetUserId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  moderatorId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  reason: varchar({ length: REASON_LENGTH }).notNull(),
  createdAt: createdAt(),
  revokedAt: timestamp({ withTimezone: true }),
  revokedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id),
});
