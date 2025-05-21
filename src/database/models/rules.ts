import { pgTable, serial, varchar, text, timestamp, pgEnum, integer, char } from 'drizzle-orm/pg-core';
import { MAX_COMMENT_LENGTH, SNOWFLAKE_ID_LENGTH } from '~/settings';

import { tblGuild } from './guilds';
import { unique } from 'drizzle-orm/gel-core';

/** @warning must be string based at all times!  */
export enum RuleCategory {
  General = 'general',
  Behaviour = 'behaviour',
  Messages = 'messages',
  Voice = 'voice',
  Advertisements = 'advertisements',
  Channels = 'channels',
  ProhibitedContent = 'prohibited-content',
  UserProfiles = 'user-profiles',
  Reporting = 'reporting',
  Punishments = 'punishments',
}

export const ruleCategoryEnum = pgEnum('rule_category', Object.values(RuleCategory) as [string, ...string[]]);

export const tblRules = pgTable('tblRules', {
  id: serial('id').primaryKey(),
  fkGuildId: char('fkGuildId', { length: SNOWFLAKE_ID_LENGTH })
    .notNull()
    .references(() => tblGuild.id),
  title: varchar({ length: 128 }).notNull(),
  category: ruleCategoryEnum('category').notNull(),
  categoryIndex: integer().notNull(),
  content: text().notNull(),
  example: text(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});
