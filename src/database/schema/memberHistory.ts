import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';

export const memberHistory = pgTable('member_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: SNOWFLAKE_LENGTH }).notNull(),
  inviteCode: varchar('invite_code', { length: 32 }).notNull(),
  inviterId: varchar('inviter_id', { length: SNOWFLAKE_LENGTH }),
  hadAvatar: boolean('had_avatar').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
});
