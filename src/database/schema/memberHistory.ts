import { boolean, check, index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { SNOWFLAKE_LENGTH } from './shared';
import { users } from './users';

export const memberHistory = pgTable(
  'member_history',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    inviteCode: varchar({ length: 32 }).notNull(),
    inviterId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    hadAvatar: boolean().notNull(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('member_history_user_idx').on(t.userId),
    index('member_history_joined_at_brin').using('brin', t.joinedAt),
    check('member_history_invite_code_nonempty', sql`length(${t.inviteCode}) > 0`),
  ]
);
