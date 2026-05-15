import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { reportStatusEnum, ReportStatus } from './enums';
import { users } from './users';

export const reports = pgTable('reports', {
  id: serial().primaryKey(),
  reporterId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  reportedUserId: varchar({ length: SNOWFLAKE_LENGTH })
    .notNull()
    .references(() => users.id),
  channelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
  messageId: varchar({ length: SNOWFLAKE_LENGTH }),
  messageContent: text(),
  messageLink: varchar({ length: 512 }).notNull(),
  status: reportStatusEnum().notNull().default('open').$type<ReportStatus>(),
  resolvedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});
