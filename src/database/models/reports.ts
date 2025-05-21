import { pgTable, serial, varchar, timestamp, char, text } from 'drizzle-orm/pg-core';

import { MAX_COMMENT_LENGTH, SNOWFLAKE_ID_LENGTH } from '~/settings';

import { tblUsers } from './users';
import { tblGuild } from './guilds';

export const tblReports = pgTable('tblReports', {
  id: serial('id').primaryKey(),
  fkUserReportedId: char('fkUserReportedId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
  fkUserReporterId: char('fkUserReporterId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  message: text('content'),
  channelId: char('channelId', { length: SNOWFLAKE_ID_LENGTH }).notNull(),
  messageLink: varchar('messageLink', { length: MAX_COMMENT_LENGTH }).notNull(),
});
