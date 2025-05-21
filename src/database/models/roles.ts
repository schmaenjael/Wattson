import { pgTable, serial, char } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_ID_LENGTH } from '~/settings';

import { tblGuild } from './guilds';

export const tblRoles = pgTable('tblRoles', {
  id: char('discordId', { length: SNOWFLAKE_ID_LENGTH }).notNull().primaryKey(),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
});
