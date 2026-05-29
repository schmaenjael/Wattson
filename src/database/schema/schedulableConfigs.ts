import { pgTable, varchar } from 'drizzle-orm/pg-core';

export const schedulableConfigs = pgTable('schedulable_configs', {
  name: varchar({ length: 64 }).primaryKey(),
  cronExpression: varchar({ length: 128 }).notNull(),
});
