import { date, index, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const memberActivityDaily = pgTable(
  'member_activity_daily',
  {
    userId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    messageCount: integer().notNull().default(0),
    voiceSeconds: integer().notNull().default(0),
    reactionCount: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] }), index('member_activity_day_brin').using('brin', t.day)]
);
