import { index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { reportStatusEnum, ReportStatus } from './enums';
import { users } from './users';

export const reports = pgTable(
  'reports',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    reporterId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    reportedUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    channelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    messageId: varchar({ length: SNOWFLAKE_LENGTH }),
    messageContent: text(),
    logMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    todoMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    status: reportStatusEnum().notNull().default('open').$type<ReportStatus>(),
    resolvedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('reports_status_idx').on(t.status), index('reports_reported_user_idx').on(t.reportedUserId)]
);
