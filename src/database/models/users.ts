import { pgTable, serial, char, varchar, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_ID_LENGTH, USERNAME_LENGTH } from '~/settings';
import { tblGuild } from './guilds';

export const tblUsers = pgTable('tblUsers', {
  id: char('discordId', { length: SNOWFLAKE_ID_LENGTH }).primaryKey().notNull(),
  username: char('username', { length: USERNAME_LENGTH }).notNull(),
  joinedDiscord: timestamp('joinedDiscord', { withTimezone: true }).notNull().defaultNow(),
});

export const tblUsernameHistory = pgTable('tblUsernameHistory', {
  id: serial('id').primaryKey(),
  fkUserId: char('fkUserId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
  username: varchar('username', { length: USERNAME_LENGTH }).notNull(),
  changedAt: timestamp('changedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const tblUsersInGuild = pgTable('tblUsersInGuild', {
  id: serial('id').primaryKey(),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
  fkUserId: char('fkUserId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblUsers.id),
});
