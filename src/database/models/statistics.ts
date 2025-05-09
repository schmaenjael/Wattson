import { pgTable, serial, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

import { tblGuild } from './guilds';

export const tblStatistics = pgTable('tblStatistics', {
  id: serial('id').primaryKey(),
  fkGuildId: serial('fkGuildId')
    .notNull()
    .references(() => tblGuild.id),
  name: varchar('name', { length: 100 }).notNull(),
  value: jsonb('value').notNull(),
  recordedAt: timestamp('recordedAt', { withTimezone: true }).notNull().defaultNow(),
});
