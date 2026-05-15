import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';

import { stickyLevelEnum } from './enums';
import { createdAt, snowflake, updatedAt } from './shared';

export const stickyMessages = pgTable('sticky_messages', {
  id: serial().primaryKey(),
  channelId: snowflake().notNull().unique(),
  message: text().notNull(),
  level: stickyLevelEnum().notNull().default('info'),
  interval: integer().notNull().default(5),
  extendedExplanation: text().notNull(),
  lastMessageId: snowflake(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
