import { pgTable, serial, char, varchar, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_ID_LENGTH, USERNAME_LENGTH } from '~/settings';
import { tblGuild } from './guilds';

export const tblUsers = pgTable('tblUsers', {
  id: serial('id').primaryKey(),
  discordId: char('discordId', { length: SNOWFLAKE_ID_LENGTH }).unique().notNull(),
  username: char('username', { length: USERNAME_LENGTH }).notNull(),
  joinedDiscord: timestamp('joinedDiscord', { withTimezone: true }).notNull().defaultNow(),
  partyMember: boolean('partyMember').notNull(),
});

export const tblUsersInGuild = pgTable('tblUsersInGuild', {
  id: serial('id').primaryKey(),
  fkGuildId: serial('fkGuildId')
    .notNull()
    .references(() => tblGuild.id),
  fkUserId: serial('fkUserId')
    .notNull()
    .references(() => tblUsers.id),
});
