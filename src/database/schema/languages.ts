import { boolean, integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core';

import { languageGroupEnum, LanguageGroup } from './enums';

export const languages = pgTable('languages', {
  id: serial().primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  code: varchar({ length: 10 }).notNull().unique(),
  group: languageGroupEnum().notNull().$type<LanguageGroup>(),
  showInMenu: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
});
