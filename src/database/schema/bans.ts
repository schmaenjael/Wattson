import { boolean, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { appealOutcomeEnum, AppealOutcome } from './enums';
import { users } from './users';

export const bans = pgTable('bans', {
  id: serial().primaryKey(),
  targetUserId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  moderatorId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  reason: varchar({ length: REASON_LENGTH }).notNull(),
  expiresAt: timestamp({ withTimezone: true }),
  appealable: boolean().notNull().default(false),
  active: boolean().notNull().default(true),
  appealedAt: timestamp({ withTimezone: true }),
  appealOutcome: appealOutcomeEnum().$type<AppealOutcome>(),
  createdAt: createdAt(),
});
