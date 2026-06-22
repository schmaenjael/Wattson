import { boolean, check, index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { moderationStatusEnum, ModerationStatus } from './enums';
import { users } from './users';

export const bans = pgTable(
  'bans',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    targetUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    appealable: boolean().notNull().default(false),
    status: moderationStatusEnum().notNull().default(ModerationStatus.Active).$type<ModerationStatus>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('bans_active_target_idx')
      .on(t.targetUserId)
      .where(sql`${t.status} = 'active'`),
    index('bans_expires_at_idx').on(t.expiresAt),
    index('bans_created_at_brin').using('brin', t.createdAt),
    check('bans_reason_nonempty', sql`length(${t.reason}) > 0`),
  ]
);
