import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

import { MAX_COMMENT_LENGTH } from '~/settings';

import { tblUsers } from './users';
import { tblGuild } from './guilds';

export const tblReports = pgTable('tblReports', {
  id: serial('id').primaryKey(),
  fkUserReportedId: serial('fkUserReportedId')
    .notNull()
    .references(() => tblUsers.id),
  fkUserReporterId: serial('fkUserReporterId')
    .notNull()
    .references(() => tblUsers.id),
  fkGuildId: serial('fkGuildId')
    .notNull()
    .references(() => tblGuild.id),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  comment: varchar('comment', { length: MAX_COMMENT_LENGTH }),
});
