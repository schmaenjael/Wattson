import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { courtStatusEnum, CourtStatus } from './enums';
import { users } from './users';

export const courtCases = pgTable('court_cases', {
  id: serial().primaryKey(),
  accusedUserId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  openedByModeratorId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  threadId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
  parentChannelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
  reason: varchar({ length: REASON_LENGTH }).notNull(),
  status: courtStatusEnum().notNull().default('open').$type<CourtStatus>(),
  verdict: text(),
  summary: text(),
  voteMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
  openedAt: createdAt(),
  closedAt: timestamp({ withTimezone: true }),
  closedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id),
});
