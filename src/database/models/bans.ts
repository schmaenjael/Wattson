import { pgTable, serial, varchar, boolean, timestamp, char } from 'drizzle-orm/pg-core';

import { tblUsers } from './users';
import { tblGuild } from './guilds';

import { MAX_COMMENT_LENGTH, SNOWFLAKE_ID_LENGTH } from '~/settings';

export const tblBans = pgTable('tblBans', {
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
  expiresAt: timestamp('expiresAt', { withTimezone: true }),
  comment: varchar('comment', { length: MAX_COMMENT_LENGTH }),
  appealable: boolean('appealable').default(false).notNull(),
  successfullyAppealed: boolean('successfullyAppealed'),
});
