import { boolean, pgTable, serial, varchar } from 'drizzle-orm/pg-core';

import { continentEnum, Continents } from './enums';

export const countries = pgTable('countries', {
  id: serial().primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  code: varchar({ length: 4 }).notNull().unique(),
  region: continentEnum().notNull().$type<Continents>(),
  chapter: boolean().notNull().default(false),
  enabled: boolean().notNull().default(false),
});
