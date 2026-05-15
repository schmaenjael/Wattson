import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { modmailCategoryEnum, modmailStatusEnum, ModmailStatus } from './enums';
import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const modmails = pgTable('modmails', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  threadId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
  category: modmailCategoryEnum().notNull(),
  reason: varchar({ length: REASON_LENGTH }).notNull(),
  status: modmailStatusEnum().notNull().default(ModmailStatus.Open),
  createdAt: createdAt(),
  closedAt: timestamp({ withTimezone: true }),
  lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  reminderSentAt: timestamp({ withTimezone: true }),
  staleNotifiedAt: timestamp({ withTimezone: true }),
  staleMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
  staleDmMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
});
