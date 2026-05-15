import { integer, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './shared';
import { ruleCategoryEnum, RuleCategory } from './enums';

export const rules = pgTable('rules', {
  id: serial().primaryKey(),
  title: varchar({ length: 128 }).notNull(),
  category: ruleCategoryEnum().notNull().$type<RuleCategory>(),
  categoryIndex: integer().notNull(),
  content: text().notNull(),
  example: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
