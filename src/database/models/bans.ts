import { pgTable, serial, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

import { tblUsers } from './users';
import { tblGuild } from './guilds';

import { MAX_COMMENT_LENGTH } from '~/settings';

export const tblBans = pgTable('tblBans', {
  id: serial('id').primaryKey(),
  fkUserTargetId: serial('fkUserTargetId')
    .notNull()
    .references(() => tblUsers.id),
  fkModeratorId: serial('fkModeratorId')
    .notNull()
    .references(() => tblUsers.id),
  fkGuildId: serial('fkGuildId')
    .notNull()
    .references(() => tblGuild.id),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }),
  comment: varchar('comment', { length: MAX_COMMENT_LENGTH }),
  appealable: boolean('appealable').notNull(),
  successfullyAppealed: boolean('successfullyAppealed'),
});
