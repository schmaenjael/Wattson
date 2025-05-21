import { pgTable, serial, varchar, jsonb, timestamp, char } from 'drizzle-orm/pg-core';

import { tblGuild } from './guilds';
import { SNOWFLAKE_ID_LENGTH } from '~/settings';

export const tblStatistics = pgTable('tblStatistics', {
  id: serial('id').primaryKey(),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
  name: varchar('name', { length: 100 }).notNull(),
  value: jsonb('value').notNull(),
  recordedAt: timestamp('recordedAt', { withTimezone: true }).notNull().defaultNow(),
});
