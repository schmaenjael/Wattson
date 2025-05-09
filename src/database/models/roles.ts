import { pgTable, serial, char } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_ID_LENGTH } from '~/settings';

import { tblGuild } from './guilds';

export const tblRoles = pgTable('tblRoles', {
  id: serial('id').primaryKey(),
  discordId: char('discordId', { length: SNOWFLAKE_ID_LENGTH }).notNull(),
  fkGuildId: serial('fkGuildId')
    .notNull()
    .references(() => tblGuild.id),
});
