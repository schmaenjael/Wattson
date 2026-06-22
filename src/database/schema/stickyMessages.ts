import { integer, pgTable, text } from 'drizzle-orm/pg-core';

import { stickyLevelEnum } from './enums';
import { createdAt, snowflake, updatedAt } from './shared';

export const stickyMessages = pgTable('sticky_messages', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  channelId: snowflake().notNull().unique(),
  message: text().notNull(),
  level: stickyLevelEnum().notNull().default('info'),
  interval: integer().notNull().default(5),
  extendedExplanation: text().notNull(),
  lastMessageId: snowflake(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
