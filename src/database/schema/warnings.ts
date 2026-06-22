import { check, index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, REASON_LENGTH, SNOWFLAKE_LENGTH } from './shared';
import { moderationStatusEnum, ModerationStatus } from './enums';
import { users } from './users';

export const warnings = pgTable(
  'warnings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    targetUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    moderatorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    reason: varchar({ length: REASON_LENGTH }).notNull(),
    status: moderationStatusEnum().notNull().default(ModerationStatus.Active).$type<ModerationStatus>(),
    createdAt: createdAt(),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    revokedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('warnings_active_target_idx')
      .on(t.targetUserId)
      .where(sql`${t.status} = 'active'`),
    index('warnings_target_status_created_idx').on(t.targetUserId, t.status, t.createdAt),
    index('warnings_target_expires_idx').on(t.targetUserId, t.expiresAt),
    index('warnings_created_at_brin').using('brin', t.createdAt),
    check('warnings_reason_nonempty', sql`length(${t.reason}) > 0`),
  ]
);
