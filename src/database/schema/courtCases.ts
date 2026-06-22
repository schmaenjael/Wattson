import { check, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { courtStatusEnum, CourtStatus } from './enums';
import { users } from './users';

export const courtCases = pgTable(
  'court_cases',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    accusedUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    openedByModeratorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    threadId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    parentChannelId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    status: courtStatusEnum().notNull().default('open').$type<CourtStatus>(),
    verdict: text(),
    summary: text(),
    voteMessageId: varchar({ length: SNOWFLAKE_LENGTH }),
    openedAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
    closedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('court_cases_accused_status_idx').on(t.accusedUserId, t.status), check('court_cases_reason_nonempty', sql`length(${t.reason}) > 0`)]
);
