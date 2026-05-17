import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';

export const inviteSnapshot = pgTable('invite_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  inviterId: varchar('inviter_id', { length: SNOWFLAKE_LENGTH }),
  channelId: varchar('channel_id', { length: SNOWFLAKE_LENGTH }),
  maxUses: integer('max_uses').notNull().default(0),
  maxAge: integer('max_age').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
