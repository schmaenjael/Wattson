import { pgTable, serial, varchar, timestamp, char } from 'drizzle-orm/pg-core';
import { MAX_COMMENT_LENGTH, SNOWFLAKE_ID_LENGTH } from '~/settings';

import { tblUsers } from './users';
import { tblGuild } from './guilds';

export const tblWarnings = pgTable('tblWarnings', {
  id: serial('id').primaryKey(),
  fkUserTargetId: char('fkUserTargetId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
  fkModeratorId: char('fkModeratorId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  comment: varchar('comment', { length: MAX_COMMENT_LENGTH }),
});
