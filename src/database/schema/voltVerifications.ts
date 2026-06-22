import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const voltVerifications = pgTable('volt_verifications', {
  discordUserId: varchar({ length: SNOWFLAKE_LENGTH })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  logtoSub: varchar({ length: 255 }).notNull().unique(),
  verifiedAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  reverificationNotifiedAt: timestamp({ withTimezone: true }),
  kickNotifiedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});
