import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { modmailCategoryEnum, modmailStatusEnum, ModmailStatus } from './enums';
import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const MODMAIL_SUMMARY_LENGTH = 4096;

export const modmails = pgTable(
  'modmails',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    threadId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    category: modmailCategoryEnum().notNull(),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    status: modmailStatusEnum().notNull().default(ModmailStatus.Open),
    summary: varchar({ length: MODMAIL_SUMMARY_LENGTH }),
    createdAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reminderSentAt: timestamp({ withTimezone: true }),
    staleNotifiedAt: timestamp({ withTimezone: true }),
    staleMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    staleDmMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    closeAction: jsonb().$type<{ type: string; payload: Record<string, unknown> } | null>(),
  },
  (t) => [
    uniqueIndex('modmails_one_active_per_user')
      .on(t.userId)
      .where(sql`${t.status} IN ('open', 'stale_pending')`),
  ]
);
