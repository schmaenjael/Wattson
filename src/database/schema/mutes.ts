import { boolean, index, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const mutes = pgTable(
  'mutes',
  {
    id: serial().primaryKey(),
    targetUserId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('mutes_target_active_idx').on(t.targetUserId, t.active), index('mutes_expires_at_idx').on(t.expiresAt)]
);
