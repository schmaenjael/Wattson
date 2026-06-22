import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const inviteSnapshot = pgTable('invite_snapshot', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 32 }).notNull().unique(),
  inviterId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
  channelId: varchar({ length: SNOWFLAKE_LENGTH }),
  maxUses: integer().notNull().default(0),
  maxAge: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
});
